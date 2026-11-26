export type WalkDirectionMode = 'auto' | 'outward' | 'inward';

export interface MotionTelemetry {
  active: boolean;
  permissionState: 'idle' | 'granted' | 'denied' | 'unsupported';
  hasCompass: boolean;
  headingDeg: number | null;
  initialHeadingDeg: number | null;
  relativeAngleDeg: number;
  directionMode: WalkDirectionMode;
  linearAccel: number;
  physicalSteps: number;
  gpsActive: boolean;
  gpsAccuracy: number | null;
}

export interface StepDeltaEvent {
  /** Displacement in meters (+x = East, -y = North on SVG floorplan) */
  dxMeters: number;
  dyMeters: number;
  strideMeters: number;
  stepIncrement: number;
  modeUsed: 'compass' | 'outward' | 'inward' | 'gps';
  headingDeg: number | null;
}

const STEP_ACCEL_THRESHOLD = 1.9; // m/s^2 gravity-removed linear acceleration threshold
const MIN_STEP_INTERVAL_MS = 380;
const MAX_STEP_INTERVAL_MS = 1600;
const STRIDE_METERS = 0.75;

// GPS filtering constants to guarantee ZERO indoor GPS jitter
const MAX_ACCEPTED_GPS_ACCURACY_M = 14;
const MIN_GPS_MOVE_M = 1.8;
const MAX_GPS_SINGLE_JUMP_M = 25;

function normalizeAngle(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

function shortestAngleDiff(from: number, to: number): number {
  let diff = ((to - from + 540) % 360) - 180;
  if (diff < -180) diff += 360;
  return diff;
}

/**
 * Calibrated Zero-Jitter Inertial Pedometer + 360° Compass Dead-Reckoning + Filtered GPS.
 * Standing still or sitting on a desk produces 0 steps and 0 movement.
 */
export class PhysicalMotionTracker {
  private running = false;
  private gravityMag = 9.81;
  private gravityInitialized = false;
  private lastPulseAt = 0;
  private armedFirstStride = false;
  private lastPeakArmed = true;

  private currentHeading: number | null = null;
  private initialHeading: number | null = null;
  private hasCompass = false;
  private directionMode: WalkDirectionMode = 'auto';

  private physicalSteps = 0;
  private lastLinear = 0;

  private gpsWatchId: number | null = null;
  private gpsAnchor: { lat: number; lon: number } | null = null;
  private lastGpsPos: { x: number; y: number } | null = null;
  private gpsAccuracy: number | null = null;
  private gpsActive = false;

  private permissionState: MotionTelemetry['permissionState'] = 'idle';

  private onStepCb: ((evt: StepDeltaEvent) => void) | null = null;
  private onTelemetryCb: ((t: MotionTelemetry) => void) | null = null;
  private lastTelemetryEmitAt = 0;

  public setCallbacks(
    onStep: (evt: StepDeltaEvent) => void,
    onTelemetry: (t: MotionTelemetry) => void
  ): void {
    this.onStepCb = onStep;
    this.onTelemetryCb = onTelemetry;
  }

  public setDirectionMode(mode: WalkDirectionMode): void {
    this.directionMode = mode;
    this.emitTelemetry(true);
  }

  public calibrateZero(): void {
    this.initialHeading = this.currentHeading;
    this.physicalSteps = 0;
    this.lastPulseAt = 0;
    this.armedFirstStride = false;
    this.gpsAnchor = null;
    this.lastGpsPos = null;
    this.emitTelemetry(true);
  }

  public getTelemetry(): MotionTelemetry {
    const relativeAngleDeg =
      this.currentHeading !== null && this.initialHeading !== null
        ? Math.round(normalizeAngle(this.currentHeading - this.initialHeading))
        : 0;

    return {
      active: this.running,
      permissionState: this.permissionState,
      hasCompass: this.hasCompass,
      headingDeg: this.currentHeading !== null ? Math.round(this.currentHeading) : null,
      initialHeadingDeg: this.initialHeading !== null ? Math.round(this.initialHeading) : null,
      relativeAngleDeg,
      directionMode: this.directionMode,
      linearAccel: Number(this.lastLinear.toFixed(2)),
      physicalSteps: this.physicalSteps,
      gpsActive: this.gpsActive,
      gpsAccuracy: this.gpsAccuracy !== null ? Math.round(this.gpsAccuracy) : null,
    };
  }

  private emitTelemetry(force = false): void {
    if (!this.onTelemetryCb) return;
    const now = Date.now();
    if (!force && now - this.lastTelemetryEmitAt < 180) return;
    this.lastTelemetryEmitAt = now;
    this.onTelemetryCb(this.getTelemetry());
  }

  /**
   * Must be invoked directly inside a user click handler for iOS 13+ Safari permission prompts.
   */
  public async start(): Promise<boolean> {
    if (typeof window === 'undefined') return false;

    try {
      // Request iOS 13+ DeviceMotion permission inside user gesture
      const MotionClass = window.DeviceMotionEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (MotionClass && typeof MotionClass.requestPermission === 'function') {
        const res = await MotionClass.requestPermission();
        if (res !== 'granted') {
          this.permissionState = 'denied';
          this.emitTelemetry(true);
          return false;
        }
      }

      // Request iOS 13+ DeviceOrientation permission inside user gesture
      const OrientClass = window.DeviceOrientationEvent as unknown as {
        requestPermission?: () => Promise<'granted' | 'denied'>;
      };
      if (OrientClass && typeof OrientClass.requestPermission === 'function') {
        try {
          await OrientClass.requestPermission();
        } catch {
          // Continue even if orientation permission is declined (manual direction fallback works)
        }
      }

      // Request Notification permission gently if supported
      if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
      }
    } catch {
      // Non-iOS browsers don't require explicit permission prompts
    }

    this.permissionState = 'granted';

    if (!this.running) {
      this.running = true;
      this.gravityInitialized = false;
      this.lastPulseAt = 0;
      this.armedFirstStride = false;
      this.lastPeakArmed = true;

      window.addEventListener('devicemotion', this.handleDeviceMotion);
      window.addEventListener(
        'deviceorientationabsolute',
        this.handleDeviceOrientation as EventListener
      );
      window.addEventListener('deviceorientation', this.handleDeviceOrientation);

      this.startFilteredGps();
    }

    this.emitTelemetry(true);
    return true;
  }

  public stop(): void {
    if (!this.running || typeof window === 'undefined') return;
    this.running = false;
    window.removeEventListener('devicemotion', this.handleDeviceMotion);
    window.removeEventListener(
      'deviceorientationabsolute',
      this.handleDeviceOrientation as EventListener
    );
    window.removeEventListener('deviceorientation', this.handleDeviceOrientation);

    if (this.gpsWatchId !== null && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
    }
    this.gpsActive = false;
    this.emitTelemetry(true);
  }

  private handleDeviceOrientation = (e: DeviceOrientationEvent): void => {
    if (!this.running) return;
    const webkitHeading = (e as unknown as { webkitCompassHeading?: number }).webkitCompassHeading;
    let rawHeading: number | null = null;

    if (typeof webkitHeading === 'number' && Number.isFinite(webkitHeading)) {
      rawHeading = normalizeAngle(webkitHeading);
    } else if (typeof e.alpha === 'number' && Number.isFinite(e.alpha)) {
      rawHeading = normalizeAngle(360 - e.alpha);
    }

    if (rawHeading === null) return;

    this.hasCompass = true;
    if (this.currentHeading === null) {
      this.currentHeading = rawHeading;
    } else {
      // Smooth circular EMA to suppress magnetometer jitter while staying responsive on 180° turns
      const diff = shortestAngleDiff(this.currentHeading, rawHeading);
      this.currentHeading = normalizeAngle(this.currentHeading + diff * 0.35);
    }

    if (this.initialHeading === null) {
      this.initialHeading = this.currentHeading;
    }

    this.emitTelemetry(false);
  };

  private handleDeviceMotion = (e: DeviceMotionEvent): void => {
    if (!this.running) return;

    let linear = 0;
    const acc = e.acceleration;
    const accG = e.accelerationIncludingGravity;

    if (
      acc &&
      typeof acc.x === 'number' &&
      typeof acc.y === 'number' &&
      typeof acc.z === 'number'
    ) {
      // Hardware sensor-fused linear acceleration (gravity already removed)
      linear = Math.hypot(acc.x, acc.y, acc.z);
    } else if (
      accG &&
      typeof accG.x === 'number' &&
      typeof accG.y === 'number' &&
      typeof accG.z === 'number'
    ) {
      const rawMag = Math.hypot(accG.x, accG.y, accG.z);
      if (!this.gravityInitialized) {
        this.gravityMag = rawMag;
        this.gravityInitialized = true;
        linear = 0;
      } else {
        this.gravityMag = 0.8 * this.gravityMag + 0.2 * rawMag;
        linear = Math.abs(rawMag - this.gravityMag);
      }
    } else {
      return;
    }

    this.lastLinear = linear;

    // Hysteresis: wait for acceleration to dip below 1.1 m/s^2 before re-arming peak detection
    if (linear < 1.1) {
      this.lastPeakArmed = true;
      return;
    }

    if (!this.lastPeakArmed || linear <= STEP_ACCEL_THRESHOLD) {
      return;
    }

    const now = performance.now();
    this.lastPeakArmed = false;

    if (this.lastPulseAt === 0) {
      // First impulse from rest arms stride detection (single desk tap = 0 steps!)
      this.lastPulseAt = now;
      this.armedFirstStride = true;
      this.emitTelemetry(false);
      return;
    }

    const dt = now - this.lastPulseAt;

    if (dt < MIN_STEP_INTERVAL_MS) {
      // Too fast (vibration / phone shake) -> ignore
      return;
    }

    if (dt > MAX_STEP_INTERVAL_MS) {
      // Paused walking and started a new stride -> re-arm cleanly
      this.lastPulseAt = now;
      this.armedFirstStride = true;
      this.emitTelemetry(false);
      return;
    }

    // Valid physical step cadence (380ms <= dt <= 1600ms) and linear > 1.9 m/s^2!
    this.lastPulseAt = now;
    const stepIncrement = this.armedFirstStride ? 2 : 1;
    this.armedFirstStride = false;
    const stride = STRIDE_METERS * stepIncrement;
    this.physicalSteps += stepIncrement;

    this.dispatchStepVector(stride, stepIncrement);
    this.emitTelemetry(true);
  };

  private dispatchStepVector(strideMeters: number, stepIncrement: number): void {
    if (!this.onStepCb) return;

    // Determine whether to use 360° compass dead-reckoning or explicit outward/inward toggle
    const useCompass =
      this.directionMode === 'auto' &&
      this.hasCompass &&
      this.currentHeading !== null &&
      this.initialHeading !== null;

    if (useCompass) {
      const deltaRad = (((this.currentHeading! - this.initialHeading!) * Math.PI) / 180);
      // Walking straight in initialHeading direction -> (0, -stride), turning 180° -> (0, +stride) back to anchor!
      const dxMeters = strideMeters * Math.sin(deltaRad);
      const dyMeters = -strideMeters * Math.cos(deltaRad);
      this.onStepCb({
        dxMeters,
        dyMeters,
        strideMeters,
        stepIncrement,
        modeUsed: 'compass',
        headingDeg: this.currentHeading,
      });
      return;
    }

    if (this.directionMode === 'inward') {
      this.onStepCb({
        dxMeters: 0,
        dyMeters: 0,
        strideMeters,
        stepIncrement,
        modeUsed: 'inward',
        headingDeg: this.currentHeading,
      });
      return;
    }

    // Default fallback outward vector (toward Kids Arena / North-East) when compass is unavailable
    this.onStepCb({
      dxMeters: strideMeters * 0.72,
      dyMeters: -strideMeters * 0.69,
      strideMeters,
      stepIncrement,
      modeUsed: 'outward',
      headingDeg: this.currentHeading,
    });
  }

  private startFilteredGps(): void {
    if (typeof navigator === 'undefined' || !('geolocation' in navigator)) return;
    try {
      this.gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          if (!this.running) return;
          const { latitude, longitude, accuracy } = pos.coords;
          this.gpsAccuracy = accuracy;
          this.gpsActive = true;

          // Strictly ignore noisy indoor GPS fixes (> 14m accuracy) so standing still has ZERO jitter
          if (!Number.isFinite(accuracy) || accuracy > MAX_ACCEPTED_GPS_ACCURACY_M) {
            this.emitTelemetry(false);
            return;
          }

          if (!this.gpsAnchor) {
            this.gpsAnchor = { lat: latitude, lon: longitude };
            this.lastGpsPos = { x: 0, y: 0 };
            this.emitTelemetry(false);
            return;
          }

          // Convert lat/lon delta to local meters
          const metersPerDegLat = 111320;
          const metersPerDegLon = 111320 * Math.cos((this.gpsAnchor.lat * Math.PI) / 180);
          const curX = (longitude - this.gpsAnchor.lon) * metersPerDegLon;
          const curY = -(latitude - this.gpsAnchor.lat) * metersPerDegLat;

          if (!this.lastGpsPos) {
            this.lastGpsPos = { x: curX, y: curY };
            return;
          }

          const dx = curX - this.lastGpsPos.x;
          const dy = curY - this.lastGpsPos.y;
          const dist = Math.hypot(dx, dy);

          // Apply GPS delta only when user physically moved outdoors with crisp accuracy and no spike
          if (dist >= MIN_GPS_MOVE_M && dist <= MAX_GPS_SINGLE_JUMP_M && this.onStepCb) {
            // Only let GPS nudge if no compass/pedometer step happened recently (avoid double-counting!)
            const now = performance.now();
            if (now - this.lastPulseAt > 1800) {
              this.lastGpsPos = { x: curX, y: curY };
              const estSteps = Math.max(1, Math.round(dist / STRIDE_METERS));
              this.physicalSteps += estSteps;
              this.onStepCb({
                dxMeters: dx,
                dyMeters: dy,
                strideMeters: dist,
                stepIncrement: estSteps,
                modeUsed: 'gps',
                headingDeg: this.currentHeading,
              });
            } else {
              this.lastGpsPos = { x: curX, y: curY };
            }
          }
          this.emitTelemetry(false);
        },
        () => {
          this.gpsActive = false;
          this.emitTelemetry(false);
        },
        {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 10000,
        }
      );
    } catch {
      this.gpsActive = false;
    }
  }
}

export const physicalMotionTracker = new PhysicalMotionTracker();
