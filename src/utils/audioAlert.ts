import { AlertSeverity } from '../types/safestep';

class AudioAlertEngine {
  private ctx: AudioContext | null = null;
  private timerId: number | null = null;
  private activeSeverity: AlertSeverity | null = null;
  private activeTimestamp = 0;
  private enabled = false;

  private ensureContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Unlocks Web Audio on mobile Safari/Chrome via a user gesture.
   */
  public async unlock(): Promise<boolean> {
    const ctx = this.ensureContext();
    if (!ctx) return false;
    try {
      await ctx.resume();
      // Play a tiny pleasant confirmation chime to verify audio output
      this.playTone(587.33, 0.09, 0.08, 'sine', 0);
      this.playTone(880, 0.14, 0.07, 'sine', 0.09);
      this.enabled = true;
      return true;
    } catch {
      return false;
    }
  }

  public setEnabled(val: boolean): void {
    this.enabled = val;
    if (!val) {
      this.stopAlarm();
    } else {
      this.ensureContext();
    }
  }

  private playTone(
    freq: number,
    durationSec: number,
    volume: number,
    type: OscillatorType,
    delaySec = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || ctx.state === 'suspended') return;

    const startTime = ctx.currentTime + delaySec;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, startTime);

    gain.gain.setValueAtTime(0.0001, startTime);
    gain.gain.exponentialRampToValueAtTime(volume, startTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + durationSec);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(startTime);
    osc.stop(startTime + durationSec + 0.03);
  }

  private triggerPulse(severity: AlertSeverity): void {
    if (!this.enabled) return;
    const ctx = this.ensureContext();
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    if (severity === 'critical') {
      // High-priority dual-tone security siren pulse
      this.playTone(987.77, 0.2, 0.16, 'triangle', 0);
      this.playTone(1318.5, 0.22, 0.16, 'triangle', 0.23);
      this.playTone(987.77, 0.2, 0.15, 'triangle', 0.48);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([240, 100, 240, 100, 320]);
        } catch {
          // ignore on unsupported devices
        }
      }
    } else {
      // Distinct boundary warning pulse
      this.playTone(698.46, 0.22, 0.14, 'sine', 0);
      this.playTone(880, 0.26, 0.14, 'sine', 0.26);
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate([200, 140, 200]);
        } catch {
          // ignore
        }
      }
    }
  }

  public startAlarm(severity: AlertSeverity, alertTimestamp: number): void {
    if (!this.enabled) return;

    // If same alarm timestamp and severity already ringing, do not duplicate timers
    if (
      this.timerId !== null &&
      this.activeSeverity === severity &&
      this.activeTimestamp === alertTimestamp
    ) {
      return;
    }

    this.stopAlarm();
    this.activeSeverity = severity;
    this.activeTimestamp = alertTimestamp;

    // Always resume AudioContext cleanly before every new alarm sequence
    this.ensureContext();
    this.triggerPulse(severity);

    const intervalMs = severity === 'critical' ? 1150 : 1650;
    this.timerId = window.setInterval(() => {
      if (!this.enabled) {
        this.stopAlarm();
        return;
      }
      this.triggerPulse(severity);
    }, intervalMs);
  }

  public stopAlarm(): void {
    if (this.timerId !== null) {
      window.clearInterval(this.timerId);
      this.timerId = null;
    }
    this.activeSeverity = null;
    this.activeTimestamp = 0;

    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(0);
      } catch {
        // ignore
      }
    }
  }

  public playRecoveryChime(): void {
    this.stopAlarm();
    if (!this.enabled) return;
    this.ensureContext();
    this.playTone(523.25, 0.14, 0.11, 'sine', 0);
    this.playTone(659.25, 0.16, 0.11, 'sine', 0.11);
    this.playTone(783.99, 0.24, 0.11, 'sine', 0.22);
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(70);
      } catch {
        // ignore
      }
    }
  }
}

export const audioAlertEngine = new AudioAlertEngine();
