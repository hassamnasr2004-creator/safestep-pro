import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BoothControlView } from './components/BoothControlView';
import { JurySummaryView } from './components/JurySummaryView';
import { ParentPhoneView } from './components/ParentPhoneView';
import { QrStudioView } from './components/QrStudioView';
import {
  DEFAULT_CHILD_POS,
  DEFAULT_PARENT_POS,
  PIXELS_PER_METER,
  clampToMall,
  createNewBandSession,
  evaluateBandSession,
} from './data/mallConfig';
import {
  BandSession,
  EditionId,
  MainTab,
  Point,
  SafeStepStore,
  ScenarioId,
  SyncStatus,
} from './types/safestep';
import { audioAlertEngine } from './utils/audioAlert';
import { loadStore, saveSingleBandToCache, saveStore } from './utils/storage';
import { syncEngine } from './utils/syncEngine';

const NAV_TABS: Array<{ id: MainTab; label: string }> = [
  { id: 'booth', label: 'البوث وغرفة التحكم الحية' },
  { id: 'phone', label: 'معاينة موبايل ولي الأمر' },
  { id: 'qr', label: 'استوديو طباعة QR' },
  { id: 'jury', label: 'ملخص الفكرة للجنة' },
];

function readScannedBandParam(): string | null {
  if (typeof window === 'undefined') return null;
  const params = new URLSearchParams(window.location.search);
  const val = params.get('p');
  return val && val.trim().length > 0 ? val.trim() : null;
}

function interpolatePath(waypoints: Point[], t: number): Point {
  if (waypoints.length === 0) return { ...DEFAULT_CHILD_POS };
  if (waypoints.length === 1 || t <= 0) return waypoints[0];
  if (t >= 1) return waypoints[waypoints.length - 1];

  // Compute segment lengths for constant-speed motion
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
  const [scannedBandId, setScannedBandId] = useState<string | null>(() => readScannedBandParam());
  const [activeTab, setActiveTab] = useState<MainTab>('booth');
  const [store, setStore] = useState<SafeStepStore>(() => loadStore());
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('connecting');
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  const [showIssueModal, setShowIssueModal] = useState<boolean>(false);
  const [runningScenario, setRunningScenario] = useState<ScenarioId | null>(null);
  const [recoveryToast, setRecoveryToast] = useState<string | null>(null);

  // Standalone phone band state (populated from local cache & live MQTT retained topic)
  const [remoteBand, setRemoteBand] = useState<BandSession | null>(() => {
    const paramId = readScannedBandParam();
    if (!paramId) return null;
    const cached = loadStore();
    return cached.bands[paramId] ?? null;
  });

  const storeRef = useRef<SafeStepStore>(store);
  storeRef.current = store;

  const animFrameRef = useRef<number | null>(null);
  const lastPublishAtRef = useRef<number>(0);
  const lastHandledRecoveryRef = useRef<number>(0);
  const recoveryTimerRef = useRef<number | null>(null);

  // Cancel any running corridor animation safely
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

  // Initialize MQTT + BroadcastChannel Sync Engine
  useEffect(() => {
    const unsubStatus = syncEngine.onStatusChange((status) => {
      setSyncStatus(status);
    });

    if (scannedBandId) {
      // Scanned Smartphone Mode: Subscribe ONLY to this specific child's band
      const unsubBand = syncEngine.subscribeBand(scannedBandId, (incoming) => {
        setRemoteBand(incoming);
        saveSingleBandToCache(incoming);
      });

      // Also listen for localStorage updates in same browser
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

    // Booth Control Mode: Publish currently active band once MQTT connects so newly scanned phones get retained state
    const unsubGlobal = syncEngine.subscribeAll((incoming) => {
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
    });

    return () => {
      unsubStatus();
      unsubGlobal();
    };
  }, [scannedBandId]);

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

  // Clean up animation and audio on unmount
  useEffect(() => {
    return () => {
      cancelAnimation();
      audioAlertEngine.stopAlarm();
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
      // AUTO-CLEAR RULE: Immediately silence Web Audio siren & vibration when safe!
      audioAlertEngine.stopAlarm();
    }

    // Trigger 4-second Emerald Auto-Recovery Toast whenever a fresh recovery occurs
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
    [publishBandState]
  );

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

  // 8-way directional step pad (+1.5m deterministic steps)
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

  // Reset trail & alerts cleanly for repeatable Jury Demos (20x in a row with zero stuck audio)
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
        // Smooth ease-in-out cubic curve
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
        // Move parent near central-east corridor, child walks smoothly into Kids Arena staying inside Safe Radius
        const pStart = current.parentPos;
        const pTarget: Point = { x: 610, y: 240 };
        const cStart = current.childPos;
        const safeDeltaPx = Math.max(70, Math.min(current.safeRadius * PIXELS_PER_METER * 0.65, 130));
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
          [cStart, { x: 560, y: 280 }, { x: 650, y: 220 }, cTarget],
          [pStart, pTarget],
          2400
        );
        return;
      }

      if (scenario === 'breach_radius') {
        // Walk child clearly beyond safeRadius into deep Kids Arena / East Wing
        const pPos = current.parentPos;
        const cStart = current.childPos;
        const breachDistPx = current.safeRadius * PIXELS_PER_METER + 78;
        // Aim towards North-East or South-West depending on room available
        const targetX = pPos.x < 520 ? Math.min(895, pPos.x + breachDistPx) : Math.max(105, pPos.x - breachDistPx);
        const targetY = pPos.y > 260 ? Math.max(115, pPos.y - 140) : Math.min(510, pPos.y + 150);

        runCorridorAnimation(
          scenario,
          [
            cStart,
            { x: (cStart.x + targetX) / 2, y: 295 },
            { x: targetX, y: targetY },
          ],
          null,
          2500
        );
        return;
      }

      if (scenario === 'return_to_parent') {
        // Walk child smoothly back directly next to parent -> crosses inside safeRadius -> AUTO-CLEARS alarm & silences phone!
        const cStart = current.childPos;
        const pPos = current.parentPos;
        const reunionPos = clampToMall({ x: pPos.x + 36, y: pPos.y - 16 });

        runCorridorAnimation(
          scenario,
          [
            cStart,
            { x: (cStart.x + reunionPos.x) / 2, y: (cStart.y + reunionPos.y) / 2 },
            reunionPos,
          ],
          null,
          2200,
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
        // Smooth corridor walk right up to Gate 1 (within ~2m of North laser threshold!)
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
        // Child stays unattended in Kids Arena while Parent walks away toward Food Court
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
        return { ok: false, error: 'رمز التسليم غير مطابق — يرجى التأكد من الرقم الظاهر في هاتف ولي الأمر' };
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

      // Publish retained ended state so any connected parent smartphone immediately shows graceful completion card
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
    setScannedBandId(null);
    if (typeof window !== 'undefined') {
      const cleanUrl = `${window.location.origin}${window.location.pathname}`;
      window.history.replaceState({}, '', cleanUrl);
    }
    setStore(loadStore());
  }, []);

  // =========================================================================
  // RENDER MODE A: SCANNED PARENT SMARTPHONE MODE (?p=BAND_ID)
  // Strict Role Isolation — NO admin navbar, NO booth controls, ONLY this child
  // =========================================================================
  if (scannedBandId) {
    return (
      <ParentPhoneView
        band={activeBand}
        requestedBandId={scannedBandId}
        standaloneMode
        syncStatus={syncStatus}
        audioEnabled={audioEnabled}
        onUnlockAudio={handleUnlockAudio}
        onToggleAudio={handleToggleAudio}
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
      {/* Persistent Crystal-Clear Frosted-Glass Top Navigation Bar (Strict 3-Zone Contract) */}
      <header className="no-print sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-white/90 shadow-[0_4px_24px_rgba(15,23,42,0.04)]">
        <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Brand Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('booth')}
            className="text-base sm:text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
          >
            SafeStep Booth
          </button>

          {/* Zone 2: 4 Clean Single-Line Navigation Tabs */}
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

          {/* Zone 3: 1 Primary Action Button */}
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

        {/* Mobile Tab Strip (Strictly single-line scrollable tabs for narrow screens) */}
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

      {/* Main Content Viewport */}
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

      {/* Quiet Clean Footer (Hidden in Print) */}
      <footer className="no-print border-t border-slate-200/70 bg-white/40 py-4 px-6 mt-auto">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
          <span>SafeStep Booth · بوث السوار الذكي لحماية الأطفال في المولات</span>
          <span>{store.mallName}</span>
        </div>
      </footer>
    </div>
  );
}
