import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoothControlView } from './components/BoothControlView';
import { JurySummaryView } from './components/JurySummaryView';
import { ParentPhoneView } from './components/ParentPhoneView';
import { QrStudioView } from './components/QrStudioView';
import {
  DEFAULT_CHILD_POS,
  DEFAULT_PARENT_POS,
  PIXELS_PER_METER,
  ZERO_CALIBRATED_OFFSET,
  clampToMall,
  createNewBandSession,
  evaluateBandSession,
} from './data/mallConfig';
import {
  BandSession,
  EditionId,
  MainTab,
  MobileRole,
  Point,
  SafeStepStore,
  ScenarioId,
  SyncStatus,
} from './types/safestep';
import { audioAlertEngine } from './utils/audioAlert';
import {
  MotionTelemetry,
  StepDeltaEvent,
  WalkDirectionMode,
  physicalMotionTracker,
} from './utils/physicalMotion';
import { loadStore, saveSingleBandToCache, saveStore } from './utils/storage';
import { syncEngine } from './utils/syncEngine';

const NAV_TABS: Array<{ id: MainTab; label: string }> = [
  { id: 'booth', label: 'البوث وغرفة التحكم الحية' },
  { id: 'phone', label: 'معاينة موبايل ولي الأمر' },
  { id: 'qr', label: 'استوديو طباعة QR' },
  { id: 'jury', label: 'ملخص الفكرة للجنة' },
];

interface ScannedTarget {
  bandId: string;
  role: MobileRole;
}

function readScannedTarget(): ScannedTarget | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const pVal = params.get('p');
  if (pVal && pVal.trim().length > 0) {
    return { bandId: pVal.trim(), role: 'parent' };
  }
  const wVal = params.get('w');
  if (wVal && wVal.trim().length > 0) {
    return { bandId: wVal.trim(), role: 'wristband' };
  }
  return null;
}

function interpolatePath(waypoints: Point[], t: number): Point {
  if (waypoints.length === 0) return { ...DEFAULT_CHILD_POS };
  if (waypoints.length === 1 || t <= 0) return waypoints[0];
  if (t >= 1) return waypoints[waypoints.length - 1];

  const lengths: number[] = [];
  let total = 0;
  for (let i = 0; i < waypoints.length - 1; i++) {
    const seg = Math.hypot(
      waypoints[i + 1].x - waypoints[i].x,
      waypoints[i + 1].y - waypoints[i].y
    );
    lengths.push(seg);
    total += seg;
  }
  if (total === 0) return waypoints[waypoints.length - 1];

  const targetDist = total * t;
  let accum = 0;
  for (let i = 0; i < lengths.length; i++) {
    const segLen = lengths[i];
    if (accum + segLen >= targetDist || i === lengths.length - 1) {
      const localT = segLen === 0 ? 1 : (targetDist - accum) / segLen;
      return {
        x: waypoints[i].x + (waypoints[i + 1].x - waypoints[i].x) * localT,
        y: waypoints[i].y + (waypoints[i + 1].y - waypoints[i].y) * localT,
      };
    }
    accum += segLen;
  }
  return waypoints[waypoints.length - 1];
}

export default function App() {
  const [scannedTarget, setScannedTarget] = useState<ScannedTarget | null>(() =>
    readScannedTarget()
  );
  const [activeTab, setActiveTab] = useState<MainTab>('booth');
  const [store, setStore] = useState<SafeStepStore>(() => loadStore());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [showIssueModal, setShowIssueModal] = useState<boolean>(false);
  const [runningScenario, setRunningScenario] = useState<ScenarioId | null>(null);
  const [recoveryToast, setRecoveryToast] = useState<string | null>(null);
  const [motionTelemetry, setMotionTelemetry] = useState<MotionTelemetry>(() =>
    physicalMotionTracker.getTelemetry()
  );

  // Standalone mobile band state (populated from local cache & live MQTT retained topic)
  const [remoteBand, setRemoteBand] = useState<BandSession | null>(() => {
    const target = readScannedTarget();
    if (!target) return null;
    const cached = loadStore();
    return cached.bands[target.bandId] ?? null;
  });

  const storeRef = useRef<SafeStepStore>(store);
  storeRef.current = store;

  const remoteBandRef = useRef<BandSession | null>(remoteBand);
  remoteBandRef.current = remoteBand;

  const animFrameRef = useRef<number | null>(null);
  const lastPublishAtRef = useRef<number>(0);
  const lastHandledRecoveryRef = useRef<number>(0);
  const recoveryTimerRef = useRef<number | null>(null);

  const scannedBandId = scannedTarget?.bandId ?? null;
  const scannedRole: MobileRole = scannedTarget?.role ?? 'parent';

  // Stable list of active band IDs for two-way Booth MQTT subscription
  const activeBandIdsKey = useMemo(
    () =>
      Object.values(store.bands)
        .filter((b) => b.status === 'active')
        .map((b) => b.bandId)
        .sort()
        .join(','),
    [store.bands]
  );

  const cancelAnimation = useCallback(() => {
    if (animFrameRef.current !== null) {
      window.cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    setRunningScenario(null);
  }, []);

  // Persist store changes to localStorage ('safestep_master_v1')
  useEffect(() => {
    if (!scannedBandId) {
      saveStore(store);
    }
  }, [store, scannedBandId]);

  // Initialize TWO-WAY MQTT + BroadcastChannel Sync Engine
  useEffect(() => {
    const unsubStatus = syncEngine.onStatusChange((status) => {
      setSyncStatus(status);
    });

    if (scannedBandId) {
      // Scanned Smartphone Mode (?p= or ?w=): Subscribe ONLY to this child's band
      const unsubBand = syncEngine.subscribeBand(scannedBandId, (incoming) => {
        setRemoteBand(incoming);
        saveSingleBandToCache(incoming);
      });

      const handleStorage = (e: StorageEvent) => {
        if (e.key === 'safestep_master_v1' && e.newValue) {
          try {
            const parsed = JSON.parse(e.newValue) as SafeStepStore;
            const found = parsed.bands?.[scannedBandId];
            if (found) setRemoteBand(found);
          } catch {
            // ignore
          }
        }
      };
      window.addEventListener('storage', handleStorage);

      return () => {
        unsubStatus();
        unsubBand();
        window.removeEventListener('storage', handleStorage);
      };
    }

    // Booth Mode (/): Explicitly subscribe to EVERY active band topic over MQTT so
    // real physical walking updates from Smartphones arrive live on the Laptop Screen!
    const ids = activeBandIdsKey ? activeBandIdsKey.split(',').filter(Boolean) : [];
    const unsubs = ids.map((id) =>
      syncEngine.subscribeBand(id, (incoming) => {
        setStore((prev) => {
          const existing = prev.bands[incoming.bandId];
          if (existing && existing.updatedAt >= incoming.updatedAt) return prev;
          return {
            ...prev,
            bands: {
              ...prev.bands,
              [incoming.bandId]: incoming,
            },
          };
        });
      })
    );

    return () => {
      unsubStatus();
      unsubs.forEach((fn) => fn());
    };
  }, [scannedBandId, activeBandIdsKey]);

  // Publish initial retained snapshot of active bands when MQTT connects in Booth Mode
  useEffect(() => {
    if (!scannedBandId && syncStatus === 'connected') {
      Object.values(storeRef.current.bands).forEach((b) => {
        if (b.status === 'active') {
          syncEngine.publishBand(b);
        }
      });
    }
  }, [scannedBandId, syncStatus]);

  // Heartbeat for 2nd Wristband Phone (?w=BAND_ID) so Booth & Phone 1 automatically switch to Dual-Phone mode
  useEffect(() => {
    if (!scannedTarget || scannedTarget.role !== 'wristband') return;

    const sendHeartbeat = () => {
      const current = remoteBandRef.current;
      if (!current || current.status !== 'active') return;
      const stamped: BandSession = {
        ...current,
        wristbandActiveAt: Date.now(),
        updatedAt: Date.now(),
      };
      setRemoteBand(stamped);
      saveSingleBandToCache(stamped);
      syncEngine.publishBand(stamped);
    };

    const initialTimer = window.setTimeout(sendHeartbeat, 1200);
    const interval = window.setInterval(sendHeartbeat, 18000);
    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(interval);
    };
  }, [scannedTarget]);

  // Real Physical Walking Step Handler (Two-Way MQTT Sync on every detected physical step!)
  const handlePhysicalStep = useCallback(
    (evt: StepDeltaEvent) => {
      if (!scannedTarget) return;
      const current = remoteBandRef.current;
      if (!current || current.status !== 'active') return;

      const now = Date.now();
      const isDualPhoneActive = Boolean(
        current.wristbandActiveAt && now - current.wristbandActiveAt < 60000
      );

      // Determine which pin moves:
      // - 2-Phone Mode: ?w= moves Child Wristband Pin, ?p= moves Parent Pin -> live relative separation!
      // - 1-Phone (?p=) + Stationary Laptop Booth: ?p= updates Child separation vector relative to Booth/Parent anchor!
      const moveParentPin = scannedTarget.role === 'parent' && isDualPhoneActive;
      const movingPoint = moveParentPin ? current.parentPos : current.childPos;
      const anchorPoint = moveParentPin ? current.childPos : current.parentPos;

      let nextPos: Point;
      if (evt.modeUsed === 'inward') {
        const vx = anchorPoint.x - movingPoint.x;
        const vy = anchorPoint.y - movingPoint.y;
        const distPx = Math.hypot(vx, vy);
        const stepPx = evt.strideMeters * PIXELS_PER_METER;
        if (distPx <= stepPx + ZERO_CALIBRATED_OFFSET.x) {
          nextPos = clampToMall({
            x: anchorPoint.x + ZERO_CALIBRATED_OFFSET.x,
            y: anchorPoint.y + ZERO_CALIBRATED_OFFSET.y,
          });
        } else {
          nextPos = clampToMall({
            x: movingPoint.x + (vx / distPx) * stepPx,
            y: movingPoint.y + (vy / distPx) * stepPx,
          });
        }
      } else {
        nextPos = clampToMall({
          x: movingPoint.x + evt.dxMeters * PIXELS_PER_METER,
          y: movingPoint.y + evt.dyMeters * PIXELS_PER_METER,
        });
      }

      const roleTimestampPatch =
        scannedTarget.role === 'wristband'
          ? { wristbandActiveAt: now }
          : { parentPhoneActiveAt: now };

      const nextBand = moveParentPin
        ? evaluateBandSession(
            current,
            {
              parentPos: nextPos,
              ...roleTimestampPatch,
            },
            { appendTrail: false }
          )
        : evaluateBandSession(
            current,
            {
              childPos: nextPos,
              stepCount: current.stepCount + evt.stepIncrement,
              ...roleTimestampPatch,
            },
            { appendTrail: true }
          );

      setRemoteBand(nextBand);
      saveSingleBandToCache(nextBand);
      // Immediately publish every physical step back over MQTT so the Laptop Booth reflects it live!
      syncEngine.publishBand(nextBand);
    },
    [scannedTarget]
  );

  // Bind PhysicalMotionTracker callbacks while in standalone mobile mode
  useEffect(() => {
    if (!scannedTarget) {
      physicalMotionTracker.stop();
      return;
    }

    physicalMotionTracker.setCallbacks(handlePhysicalStep, (t) => {
      setMotionTelemetry(t);
    });

    return () => {
      physicalMotionTracker.stop();
    };
  }, [scannedTarget, handlePhysicalStep]);

  // Clean up animation and audio on unmount
  useEffect(() => {
    return () => {
      cancelAnimation();
      audioAlertEngine.stopAlarm();
      physicalMotionTracker.stop();
      if (recoveryTimerRef.current !== null) {
        window.clearTimeout(recoveryTimerRef.current);
      }
    };
  }, [cancelAnimation]);

  const activeBand: BandSession | null = useMemo(() => {
    if (scannedBandId) return remoteBand;
    if (!store.activeBandId) return null;
    const found = store.bands[store.activeBandId];
    return found && found.status === 'active' ? found : null;
  }, [scannedBandId, remoteBand, store.activeBandId, store.bands]);

  // Reactive Web Audio Alarm & 4-Second Auto-Recovery Toast Controller
  useEffect(() => {
    if (!activeBand || activeBand.status !== 'active') {
      audioAlertEngine.stopAlarm();
      return;
    }

    if (activeBand.activeAlerts.length > 0) {
      const hasCritical = activeBand.activeAlerts.some((a) => a.severity === 'critical');
      audioAlertEngine.startAlarm(
        hasCritical ? 'critical' : 'warning',
        activeBand.lastAlertTimestamp || activeBand.updatedAt
      );
    } else {
      // AUTO-CLEAR RULE: Immediately silence Web Audio siren & vibration when safe
      audioAlertEngine.stopAlarm();
    }

    if (
      activeBand.lastRecoveredAt > 0 &&
      activeBand.lastRecoveredAt > lastHandledRecoveryRef.current &&
      activeBand.activeAlerts.length === 0
    ) {
      lastHandledRecoveryRef.current = activeBand.lastRecoveredAt;
      audioAlertEngine.playRecoveryChime();
      setRecoveryToast(
        activeBand.recoveredMessage || 'عاد الطفل إلى النطاق الآمن — تم إيقاف الإنذار تلقائياً'
      );
      if (recoveryTimerRef.current !== null) {
        window.clearTimeout(recoveryTimerRef.current);
      }
      recoveryTimerRef.current = window.setTimeout(() => {
        setRecoveryToast(null);
      }, 4200);
    }
  }, [activeBand, audioEnabled]);

  const publishBandState = useCallback((band: BandSession, force = false) => {
    const now = Date.now();
    if (force || now - lastPublishAtRef.current >= 110) {
      lastPublishAtRef.current = now;
      syncEngine.publishBand(band);
    }
  }, []);

  const mutateActiveBand = useCallback(
    (
      updater: (prev: BandSession) => BandSession,
      options?: { forcePublish?: boolean }
    ) => {
      if (scannedBandId) {
        const current = remoteBandRef.current;
        if (!current || current.status !== 'active') return;
        const nextBand = updater(current);
        setRemoteBand(nextBand);
        saveSingleBandToCache(nextBand);
        syncEngine.publishBand(nextBand);
        return;
      }

      setStore((prev) => {
        if (!prev.activeBandId) return prev;
        const current = prev.bands[prev.activeBandId];
        if (!current || current.status !== 'active') return prev;
        const nextBand = updater(current);
        const alertChanged =
          nextBand.activeAlerts.length !== current.activeAlerts.length ||
          nextBand.lastAlertTimestamp !== current.lastAlertTimestamp ||
          nextBand.lastRecoveredAt !== current.lastRecoveredAt;
        publishBandState(nextBand, options?.forcePublish || alertChanged);
        return {
          ...prev,
          bands: {
            ...prev.bands,
            [nextBand.bandId]: nextBand,
          },
        };
      });
    },
    [scannedBandId, publishBandState]
  );

  // Direct onClick handler for iOS Safari & Android Chrome:
  // Requests DeviceMotion + DeviceOrientation permissions, unlocks Web Audio, requests Notifications, starts tracking
  const handleActivatePhysicalTracking = useCallback(async () => {
    const audioOk = await audioAlertEngine.unlock();
    setAudioEnabled(audioOk);
    await physicalMotionTracker.start();
    setMotionTelemetry(physicalMotionTracker.getTelemetry());
  }, []);

  const handleSetWalkDirection = useCallback((mode: WalkDirectionMode) => {
    physicalMotionTracker.setDirectionMode(mode);
    setMotionTelemetry(physicalMotionTracker.getTelemetry());
  }, []);

  // Audio unlock / toggle handlers
  const handleUnlockAudio = useCallback(async () => {
    const ok = await audioAlertEngine.unlock();
    setAudioEnabled(ok);
  }, []);

  const handleToggleAudio = useCallback(async () => {
    if (!audioEnabled) {
      const ok = await audioAlertEngine.unlock();
      setAudioEnabled(ok);
    } else {
      audioAlertEngine.setEnabled(false);
      setAudioEnabled(false);
    }
  }, [audioEnabled]);

  // One-Tap Zero Calibration (Sets separation to 0.5m next to Laptop/Booth, resets heading & trail, silences audio)
  const handleCalibrateZero = useCallback(() => {
    cancelAnimation();
    audioAlertEngine.stopAlarm();
    physicalMotionTracker.calibrateZero();
    setMotionTelemetry(physicalMotionTracker.getTelemetry());
    setRecoveryToast(null);

    mutateActiveBand(
      (prev) => {
        const baseParent = { ...DEFAULT_PARENT_POS };
        const zeroChild = clampToMall({
          x: baseParent.x + ZERO_CALIBRATED_OFFSET.x,
          y: baseParent.y + ZERO_CALIBRATED_OFFSET.y,
        });
        return evaluateBandSession(
          prev,
          {
            parentPos: baseParent,
            childPos: zeroChild,
            trail: [zeroChild],
            stepCount: 0,
            tamperActive: false,
            claspLocked: true,
            leftBehindActive: false,
            activeAlerts: [],
            lastRecoveredAt: 0,
            recoveredMessage: '',
          },
          { appendTrail: false }
        );
      },
      { forcePublish: true }
    );
  }, [cancelAnimation, mutateActiveBand]);

  // Issue new wristband
  const handleIssueBand = useCallback(
    (childName: string, editionId: EditionId, safeRadius: number) => {
      cancelAnimation();
      setStore((prev) => {
        const bandId = `SKB-${prev.nextSerial}`;
        const created = createNewBandSession({
          bandId,
          childName,
          editionId,
          safeRadius,
          mallName: prev.mallName,
        });
        syncEngine.publishBand(created);
        return {
          ...prev,
          bands: {
            ...prev.bands,
            [bandId]: created,
          },
          activeBandId: bandId,
          nextSerial: prev.nextSerial + 1,
        };
      });
    },
    [cancelAnimation]
  );

  // Direct map drag handlers (Zero randomness, immediate deterministic update)
  const handleMoveChild = useCallback(
    (pos: Point) => {
      cancelAnimation();
      mutateActiveBand((prev) => evaluateBandSession(prev, { childPos: pos }));
    },
    [cancelAnimation, mutateActiveBand]
  );

  const handleMoveParent = useCallback(
    (pos: Point) => {
      cancelAnimation();
      mutateActiveBand((prev) =>
        evaluateBandSession(prev, { parentPos: pos }, { appendTrail: false })
      );
    },
    [cancelAnimation, mutateActiveBand]
  );

  const handleStepChild = useCallback(
    (dxMeters: number, dyMeters: number) => {
      cancelAnimation();
      mutateActiveBand(
        (prev) => {
          const nextPos = clampToMall({
            x: prev.childPos.x + dxMeters * PIXELS_PER_METER,
            y: prev.childPos.y + dyMeters * PIXELS_PER_METER,
          });
          return evaluateBandSession(prev, { childPos: nextPos });
        },
        { forcePublish: true }
      );
    },
    [cancelAnimation, mutateActiveBand]
  );

  const handleUpdateSafeRadius = useCallback(
    (radius: number) => {
      mutateActiveBand(
        (prev) => evaluateBandSession(prev, { safeRadius: radius }, { appendTrail: false }),
        { forcePublish: true }
      );
    },
    [mutateActiveBand]
  );

  const handleUpdateBattery = useCallback(
    (battery: number) => {
      mutateActiveBand(
        (prev) => evaluateBandSession(prev, { battery }, { appendTrail: false }),
        { forcePublish: true }
      );
    },
    [mutateActiveBand]
  );

  const handleConfirmClaspLock = useCallback(() => {
    mutateActiveBand(
      (prev) =>
        evaluateBandSession(
          prev,
          { tamperActive: false, claspLocked: true },
          { appendTrail: false }
        ),
      { forcePublish: true }
    );
  }, [mutateActiveBand]);

  const handleAcknowledgeLeftBehind = useCallback(() => {
    mutateActiveBand(
      (prev) => evaluateBandSession(prev, { leftBehindActive: false }, { appendTrail: false }),
      { forcePublish: true }
    );
  }, [mutateActiveBand]);

  const handleResetTrail = useCallback(() => {
    cancelAnimation();
    audioAlertEngine.stopAlarm();
    setRecoveryToast(null);
    mutateActiveBand(
      (prev) =>
        evaluateBandSession(
          prev,
          {
            parentPos: { ...DEFAULT_PARENT_POS },
            childPos: { ...DEFAULT_CHILD_POS },
            trail: [{ ...DEFAULT_CHILD_POS }],
            stepCount: 0,
            tamperActive: false,
            claspLocked: true,
            leftBehindActive: false,
            activeAlerts: [],
            lastRecoveredAt: 0,
            recoveredMessage: '',
          },
          { appendTrail: false }
        ),
      { forcePublish: true }
    );
  }, [cancelAnimation, mutateActiveBand]);

  // Smooth 60fps Animated Corridor Scenarios for Jury Presentation
  const runCorridorAnimation = useCallback(
    (
      scenarioId: ScenarioId,
      childWaypoints: Point[],
      parentWaypoints: Point[] | null,
      durationMs: number,
      onComplete?: () => void
    ) => {
      cancelAnimation();
      setRunningScenario(scenarioId);

      const startTime = performance.now();
      const tick = (now: number) => {
        const elapsed = now - startTime;
        const rawT = Math.min(1, elapsed / durationMs);
        const easedT =
          rawT < 0.5 ? 4 * rawT * rawT * rawT : 1 - Math.pow(-2 * rawT + 2, 3) / 2;

        const nextChild = interpolatePath(childWaypoints, easedT);
        const nextParent = parentWaypoints
          ? interpolatePath(parentWaypoints, easedT)
          : undefined;

        mutateActiveBand(
          (prev) =>
            evaluateBandSession(prev, {
              childPos: nextChild,
              ...(nextParent ? { parentPos: nextParent } : {}),
            }),
          { forcePublish: rawT >= 1 }
        );

        if (rawT < 1) {
          animFrameRef.current = window.requestAnimationFrame(tick);
        } else {
          animFrameRef.current = null;
          setRunningScenario(null);
          onComplete?.();
        }
      };

      animFrameRef.current = window.requestAnimationFrame(tick);
    },
    [cancelAnimation, mutateActiveBand]
  );

  const handleRunScenario = useCallback(
    (scenario: ScenarioId) => {
      const current = activeBand;
      if (!current) return;

      if (scenario === 'tamper_attempt') {
        cancelAnimation();
        mutateActiveBand(
          (prev) =>
            evaluateBandSession(
              prev,
              { tamperActive: true, claspLocked: false },
              { appendTrail: false }
            ),
          { forcePublish: true }
        );
        return;
      }

      if (scenario === 'safe_walk_kids') {
        const pStart = current.parentPos;
        const pTarget: Point = { x: 645, y: 215 };
        const cStart = current.childPos;
        const safeDeltaPx = Math.max(24, Math.min(current.safeRadius * PIXELS_PER_METER * 0.65, 110));
        const cTarget: Point = clampToMall({
          x: pTarget.x + safeDeltaPx * 0.78,
          y: pTarget.y - safeDeltaPx * 0.58,
        });

        mutateActiveBand(
          (prev) =>
            evaluateBandSession(
              prev,
              { leftBehindActive: false, tamperActive: false, claspLocked: true },
              { appendTrail: false }
            ),
          { forcePublish: false }
        );

        runCorridorAnimation(
          scenario,
          [cStart, { x: 560, y: 270 }, { x: 650, y: 220 }, cTarget],
          [pStart, pTarget],
          2400
        );
        return;
      }

      if (scenario === 'breach_radius') {
        const pPos = current.parentPos;
        const cStart = current.childPos;
        const breachDistPx = current.safeRadius * PIXELS_PER_METER + 68;
        const targetX =
          pPos.x < 520
            ? Math.min(895, pPos.x + breachDistPx)
            : Math.max(105, pPos.x - breachDistPx);
        const targetY =
          pPos.y > 260 ? Math.max(115, pPos.y - 110) : Math.min(510, pPos.y + 120);

        runCorridorAnimation(
          scenario,
          [
            cStart,
            { x: (cStart.x + targetX) / 2, y: (cStart.y + targetY) / 2 },
            { x: targetX, y: targetY },
          ],
          null,
          2400
        );
        return;
      }

      if (scenario === 'return_to_parent') {
        const cStart = current.childPos;
        const pPos = current.parentPos;
        const reunionPos = clampToMall({
          x: pPos.x + ZERO_CALIBRATED_OFFSET.x * 2,
          y: pPos.y - 6,
        });

        runCorridorAnimation(
          scenario,
          [
            cStart,
            { x: (cStart.x + reunionPos.x) / 2, y: (cStart.y + reunionPos.y) / 2 },
            reunionPos,
          ],
          null,
          2100,
          () => {
            mutateActiveBand(
              (prev) =>
                evaluateBandSession(prev, { leftBehindActive: false }, { appendTrail: false }),
              { forcePublish: true }
            );
          }
        );
        return;
      }

      if (scenario === 'approach_exit') {
        const cStart = current.childPos;
        const gate1Approach: Point = { x: 500, y: 58 };
        runCorridorAnimation(
          scenario,
          [cStart, { x: 500, y: 210 }, { x: 500, y: 120 }, gate1Approach],
          null,
          2400
        );
        return;
      }

      if (scenario === 'left_behind') {
        const cStart = current.childPos;
        const kidsSpot: Point = { x: 760, y: 165 };
        const pStart = current.parentPos;
        const foodCourtSpot: Point = { x: 250, y: 185 };

        runCorridorAnimation(
          scenario,
          [cStart, kidsSpot],
          [pStart, { x: 460, y: 280 }, foodCourtSpot],
          2400,
          () => {
            mutateActiveBand(
              (prev) =>
                evaluateBandSession(prev, { leftBehindActive: true }, { appendTrail: false }),
              { forcePublish: true }
            );
          }
        );
      }
    },
    [activeBand, cancelAnimation, mutateActiveBand, runCorridorAnimation]
  );

  // Official 4-digit PIN checkout verification
  const handleCheckoutBand = useCallback(
    (bandId: string, pin: string): { ok: boolean; error?: string } => {
      const target = storeRef.current.bands[bandId];
      if (!target) return { ok: false, error: 'لم يتم العثور على السوار' };
      if (target.tamperActive) {
        return { ok: false, error: 'يرجى تأكيد إحكام القفل الأمني أولاً' };
      }
      if (pin !== target.returnPin) {
        return {
          ok: false,
          error: 'رمز التسليم غير مطابق — يرجى التأكد من الرقم الظاهر في هاتف ولي الأمر',
        };
      }

      cancelAnimation();
      audioAlertEngine.stopAlarm();

      const endedSession: BandSession = {
        ...target,
        status: 'ended',
        endedAt: Date.now(),
        activeAlerts: [],
        claspLocked: false,
        tamperActive: false,
        leftBehindActive: false,
        updatedAt: Date.now(),
      };

      syncEngine.publishBand(endedSession);

      setStore((prev) => {
        const nextBands = {
          ...prev.bands,
          [bandId]: endedSession,
        };
        const remainingActive = Object.values(nextBands).find((b) => b.status === 'active');
        return {
          ...prev,
          bands: nextBands,
          activeBandId: remainingActive ? remainingActive.bandId : null,
        };
      });

      return { ok: true };
    },
    [cancelAnimation]
  );

  const handleExitStandalone = useCallback(() => {
    audioAlertEngine.stopAlarm();
    physicalMotionTracker.stop();
    setScannedTarget(null);
    if (typeof window !== 'undefined') {
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, '', cleanUrl);
    }
    setStore(loadStore());
  }, []);

  // =========================================================================
  // RENDER MODE A: SCANNED SMARTPHONE MODE (?p=BAND_ID or ?w=BAND_ID)
  // Strict Role Isolation + Two-Way Real Physical Walking Engine
  // =========================================================================
  if (scannedBandId) {
    return (
      <ParentPhoneView
        band={activeBand}
        requestedBandId={scannedBandId}
        mobileRole={scannedRole}
        standaloneMode
        syncStatus={syncStatus}
        audioEnabled={audioEnabled}
        onUnlockAudio={handleUnlockAudio}
        onToggleAudio={handleToggleAudio}
        motionTelemetry={motionTelemetry}
        onActivatePhysicalTracking={handleActivatePhysicalTracking}
        onSetWalkDirection={handleSetWalkDirection}
        onCalibrateZero={handleCalibrateZero}
        onUpdateSafeRadius={handleUpdateSafeRadius}
        recoveryToast={recoveryToast}
        onExitStandalone={handleExitStandalone}
      />
    );
  }

  // =========================================================================
  // RENDER MODE B: MAIN APPLICATION (/) WITH PERSISTENT 4-TAB TOP NAVBAR
  // =========================================================================
  const allBandsList = Object.values(store.bands);

  return (
    <div className="min-h-screen flex flex-col">
      {/* Persistent Crystal-Clear Frosted-Glass Top Navigation Bar */}
      <header className="no-print sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-white/90 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('booth')}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SafeStep Booth
          </button>

          <nav
            aria-label="التنقل الرئيسي"
            className="hidden md:flex items-center gap-6 overflow-x-auto"
          >
            {NAV_TABS.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative py-2 text-xs lg:text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-slate-900 font-semibold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                  {isActive && (
                    <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-slate-900 rounded-full" />
                  )}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => {
                setActiveTab('booth');
                setShowIssueModal(true);
              }}
              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors whitespace-nowrap shrink-0"
            >
              إصدار سوار جديد
            </button>
          </div>
        </div>

        <div className="md:hidden border-t border-slate-200/60 px-3 py-2 flex items-center gap-1.5 overflow-x-auto">
          {NAV_TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors ${
                  isActive
                    ? 'bg-slate-900 text-white'
                    : 'text-slate-600 hover:text-slate-900 bg-white/70'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </header>

      <main className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {activeTab === 'booth' && (
          <BoothControlView
            bands={allBandsList}
            activeBand={activeBand}
            publicBaseUrl={store.publicBaseUrl}
            onUpdatePublicBaseUrl={(url) =>
              setStore((prev) => ({ ...prev, publicBaseUrl: url }))
            }
            onSelectBand={(id) => {
              cancelAnimation();
              setStore((prev) => ({ ...prev, activeBandId: id }));
            }}
            onIssueBand={handleIssueBand}
            onMoveChild={handleMoveChild}
            onMoveParent={handleMoveParent}
            onStepChild={handleStepChild}
            onUpdateSafeRadius={handleUpdateSafeRadius}
            onUpdateBattery={handleUpdateBattery}
            onRunScenario={handleRunScenario}
            runningScenario={runningScenario}
            onConfirmClaspLock={handleConfirmClaspLock}
            onAcknowledgeLeftBehind={handleAcknowledgeLeftBehind}
            onResetTrail={handleResetTrail}
            onCalibrateZero={handleCalibrateZero}
            onCheckoutBand={handleCheckoutBand}
            audioEnabled={audioEnabled}
            onToggleAudio={handleToggleAudio}
            showIssueModal={showIssueModal}
            onSetShowIssueModal={setShowIssueModal}
            recoveryToast={recoveryToast}
          />
        )}

        {activeTab === 'phone' && (
          <ParentPhoneView
            band={activeBand}
            standaloneMode={false}
            syncStatus={syncStatus}
            audioEnabled={audioEnabled}
            onUnlockAudio={handleUnlockAudio}
            onToggleAudio={handleToggleAudio}
            onCalibrateZero={handleCalibrateZero}
            onUpdateSafeRadius={handleUpdateSafeRadius}
            recoveryToast={recoveryToast}
            onRunScenario={handleRunScenario}
            onConfirmClaspLock={handleConfirmClaspLock}
          />
        )}

        {activeTab === 'qr' && (
          <QrStudioView
            mallName={store.mallName}
            publicBaseUrl={store.publicBaseUrl}
            onUpdateMallName={(name) =>
              setStore((prev) => ({ ...prev, mallName: name }))
            }
            onUpdatePublicBaseUrl={(url) =>
              setStore((prev) => ({ ...prev, publicBaseUrl: url }))
            }
            defaultBandId={activeBand?.bandId || 'SKB-101'}
          />
        )}

        {activeTab === 'jury' && <JurySummaryView />}
      </main>

      <footer className="no-print border-t border-slate-200/70 bg-white/40 py-4 px-6 mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>SafeStep Booth · بوث السوار الذكي لحماية الأطفال في المولات</span>
          <span>{store.mallName}</span>
        </div>
      </footer>
    </div>
  );
}
