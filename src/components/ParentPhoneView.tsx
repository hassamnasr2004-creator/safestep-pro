import React, { useState } from 'react';
import {
  AlertTriangle,
  BatteryCharging,
  BellRing,
  CheckCircle2,
  DoorOpen,
  Footprints,
  KeyRound,
  Lock,
  LockOpen,
  MapPin,
  Play,
  ShieldAlert,
  ShieldCheck,
  Volume2,
  VolumeX,
  Wifi,
} from 'lucide-react';
import { WRISTBAND_EDITIONS, getZoneBadgeStatus } from '../data/mallConfig';
import { BandSession, ScenarioId, SyncStatus } from '../types/safestep';
import { EditionBadge } from './EditionBadge';
import { SmartMallMap } from './SmartMallMap';

interface ParentPhoneViewProps {
  band: BandSession | null;
  requestedBandId?: string;
  standaloneMode: boolean;
  syncStatus: SyncStatus;
  audioEnabled: boolean;
  onUnlockAudio: () => void;
  onToggleAudio: () => void;
  recoveryToast: string | null;
  onRunScenario?: (scenario: ScenarioId) => void;
  onConfirmClaspLock?: () => void;
  onExitStandalone?: () => void;
}

const PhoneScreenContent: React.FC<{
  band: BandSession | null;
  requestedBandId?: string;
  standaloneMode: boolean;
  syncStatus: SyncStatus;
  audioEnabled: boolean;
  onUnlockAudio: () => void;
  onToggleAudio: () => void;
  recoveryToast: string | null;
}> = ({
  band,
  requestedBandId,
  standaloneMode,
  syncStatus,
  audioEnabled,
  onUnlockAudio,
  onToggleAudio,
  recoveryToast,
}) => {
  // Handle ended or unavailable band gracefully
  if (!band || band.status === 'ended') {
    const isWaitingSync = !band && syncStatus === 'connecting';
    return (
      <div className="p-5 flex flex-col items-center justify-center min-h-[460px] text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7" strokeWidth={1.8} />
        </div>
        <div className="space-y-1.5 max-w-xs">
          <h2 className="text-base font-bold text-slate-900">
            {isWaitingSync
              ? 'جاري مزامنة بيانات السوار'
              : 'تم إنهاء هذه الجلسة وتسليم السوار بنجاح'}
          </h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            {isWaitingSync
              ? `جاري الاتصال اللحظي بسوار ${requestedBandId || ''} لاسترجاع الموقع الحالي`
              : 'نشكر استخدامكم منظومة SafeStep Booth لحماية الأطفال ونتمنى لكم زيارة آمنة'}
          </p>
        </div>
        {requestedBandId && (
          <div className="text-xs text-slate-400 tabular-nums">
            رقم السوار: {requestedBandId}
          </div>
        )}
      </div>
    );
  }

  const statusLevel = getZoneBadgeStatus(band);
  const edition = WRISTBAND_EDITIONS[band.editionId];

  return (
    <div className="space-y-3.5 pb-4">
      {/* Compact Sticky App Header */}
      <div className="flex items-center justify-between gap-2 px-4 pt-4 pb-3 border-b border-slate-200/70 bg-white/85 backdrop-blur-md">
        <div className="flex items-center gap-2.5 min-w-0">
          <EditionBadge editionId={band.editionId} size="sm" />
          <div className="min-w-0">
            <h1 className="text-sm font-bold text-slate-900 truncate">تطبيق متابعة طفلي</h1>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700 truncate">{band.childName}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">{band.bandId}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] font-medium text-slate-600 shrink-0">
          <Wifi
            className={`w-3.5 h-3.5 ${
              syncStatus === 'connected' ? 'text-teal-600' : 'text-amber-600'
            }`}
            strokeWidth={2}
          />
          <span>{syncStatus === 'connected' ? 'متصل مباشر' : 'مزامنة'}</span>
        </div>
      </div>

      <div className="px-4 space-y-3.5">
        {/* Audio & Vibration Activation Control (Essential for Mobile Safari / Chrome) */}
        {!audioEnabled ? (
          <button
            type="button"
            onClick={onUnlockAudio}
            className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 text-white flex items-center justify-between gap-3 transition-colors shadow-sm"
          >
            <div className="flex items-center gap-2.5">
              <BellRing className="w-4 h-4 text-teal-300 shrink-0" strokeWidth={1.85} />
              <span className="text-xs font-semibold">تفعيل التنبيهات الصوتية والاهتزاز</span>
            </div>
            <span className="text-[11px] text-slate-300 shrink-0">اضغط للتفعيل</span>
          </button>
        ) : (
          <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-teal-50/90 border border-teal-200/80">
            <div className="flex items-center gap-2 text-xs font-semibold text-teal-900">
              <Volume2 className="w-4 h-4 text-teal-700" strokeWidth={1.85} />
              <span>التنبيهات الصوتية والاهتزاز مفعّلة</span>
            </div>
            <button
              type="button"
              onClick={onToggleAudio}
              className="text-[11px] font-semibold text-teal-800 hover:underline flex items-center gap-1"
            >
              <VolumeX className="w-3.5 h-3.5" />
              <span>كتم</span>
            </button>
          </div>
        )}

        {/* 4-Second Emerald Auto-Recovery Toast */}
        {recoveryToast && (
          <div className="rounded-2xl px-3.5 py-3 bg-teal-600 text-white flex items-center gap-2.5 shadow-sm">
            <CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={2} />
            <span className="text-xs font-semibold leading-snug">{recoveryToast}</span>
          </div>
        )}

        {/* Live Status / Active Alerts */}
        {band.activeAlerts.length > 0 ? (
          <div className="space-y-2">
            {band.activeAlerts.map((alert) => {
              const isCritical = alert.severity === 'critical';
              return (
                <div
                  key={alert.type}
                  className={`rounded-2xl p-3.5 border flex items-start gap-3 ${
                    isCritical
                      ? 'bg-red-600 border-red-700 text-white'
                      : 'bg-amber-500 border-amber-600 text-white'
                  }`}
                >
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center shrink-0 mt-0.5">
                    {alert.type === 'EXIT_GATE_ALERT' ? (
                      <DoorOpen className="w-5 h-5" strokeWidth={1.9} />
                    ) : alert.type === 'TAMPER_LOCK_ALERT' ? (
                      <LockOpen className="w-5 h-5" strokeWidth={1.9} />
                    ) : (
                      <AlertTriangle className="w-5 h-5" strokeWidth={1.9} />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-xs font-bold">{alert.title}</div>
                    <div className="text-[11px] text-white/90 mt-0.5 leading-relaxed">
                      {alert.message}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl px-3.5 py-3 bg-white/90 border border-teal-200/70 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4" strokeWidth={1.9} />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-900">طفلك داخل النطاق الآمن</div>
                <div className="text-[11px] text-slate-500">{edition.name}</div>
              </div>
            </div>
            <span className="text-xs font-bold text-teal-700 tabular-nums">
              {band.distanceMeters.toFixed(1)} م
            </span>
          </div>
        )}

        {/* Live Architectural Map (Read-Only on Parent Phone) */}
        <SmartMallMap band={band} readOnly compact />

        {/* Live Key Metrics Row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-white/85 border border-slate-200/80 p-3 text-center">
            <div className="text-[10px] text-slate-500">المسافة الحالية</div>
            <div
              className={`text-sm font-bold tabular-nums mt-1 ${
                statusLevel === 'critical'
                  ? 'text-red-600'
                  : statusLevel === 'warning'
                    ? 'text-amber-600'
                    : 'text-slate-900'
              }`}
            >
              {band.distanceMeters.toFixed(1)} م
            </div>
          </div>

          <div className="rounded-xl bg-white/85 border border-slate-200/80 p-3 text-center">
            <div className="text-[10px] text-slate-500">خطوات الطفل</div>
            <div className="text-sm font-bold text-slate-900 tabular-nums mt-1 flex items-center justify-center gap-1">
              <Footprints className="w-3.5 h-3.5 text-teal-700" strokeWidth={1.8} />
              <span>{band.stepCount}</span>
            </div>
          </div>

          <div className="rounded-xl bg-white/85 border border-slate-200/80 p-3 text-center">
            <div className="text-[10px] text-slate-500">البطارية</div>
            <div className="text-sm font-bold text-slate-900 tabular-nums mt-1 flex items-center justify-center gap-1">
              <BatteryCharging className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.8} />
              <span>{band.battery}%</span>
            </div>
          </div>
        </div>

        {/* Zone & Clasp Security Summary */}
        <div className="rounded-2xl bg-white/85 border border-slate-200/80 divide-y divide-slate-100">
          <div className="px-3.5 py-2.5 flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              القطاع الحالي
            </span>
            <span className="font-semibold text-slate-900">{band.currentZone}</span>
          </div>
          <div className="px-3.5 py-2.5 flex items-center justify-between text-xs">
            <span className="text-slate-500 flex items-center gap-1.5">
              {band.claspLocked ? (
                <Lock className="w-3.5 h-3.5 text-teal-600" />
              ) : (
                <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
              )}
              حالة القفل الذكي
            </span>
            <span
              className={`font-semibold ${
                band.claspLocked ? 'text-teal-700' : 'text-red-600'
              }`}
            >
              {band.claspLocked ? 'مؤمّن ضد الفك' : 'إنذار محاولة فك'}
            </span>
          </div>
        </div>

        {/* 4-Digit Return PIN Card */}
        <div className="rounded-2xl bg-slate-900 text-white p-4 flex items-center justify-between gap-3">
          <div className="space-y-0.5">
            <div className="flex items-center gap-1.5 text-xs font-bold">
              <KeyRound className="w-3.5 h-3.5 text-teal-300" strokeWidth={1.9} />
              <span>رمز تسليم السوار وفك القفل</span>
            </div>
            <p className="text-[11px] text-slate-300">
              يُقدّم لموظف البوث عند مغادرة {band.mallName}
            </p>
          </div>
          <div className="px-3.5 py-2 rounded-xl bg-white/12 border border-white/15 text-lg font-bold tracking-[0.25em] tabular-nums shrink-0">
            {band.returnPin}
          </div>
        </div>

        {!standaloneMode && (
          <p className="text-[11px] text-center text-slate-400 pt-1">
            معاينة حية مطابقة تماماً لشاشة هاتف ولي الأمر بعد مسح الكود
          </p>
        )}
      </div>
    </div>
  );
};

export const ParentPhoneView: React.FC<ParentPhoneViewProps> = ({
  band,
  requestedBandId,
  standaloneMode,
  syncStatus,
  audioEnabled,
  onUnlockAudio,
  onToggleAudio,
  recoveryToast,
  onRunScenario,
  onConfirmClaspLock,
  onExitStandalone,
}) => {
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminError, setAdminError] = useState('');

  const handleAdminUnlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPin.trim() === '1234') {
      setShowAdminModal(false);
      setAdminPin('');
      setAdminError('');
      onExitStandalone?.();
    } else {
      setAdminError('رمز الإدارة غير صحيح');
    }
  };

  // STANDALONE SCANNED SMARTPHONE MODE (?p=BAND_ID) — Strict Role Isolation!
  if (standaloneMode) {
    return (
      <div className="min-h-screen flex flex-col justify-between max-w-md mx-auto bg-gradient-to-b from-[#EDF2F7] via-[#F4F7FA] to-[#F8FAFC]">
        <main className="flex-1">
          <PhoneScreenContent
            band={band}
            requestedBandId={requestedBandId}
            standaloneMode
            syncStatus={syncStatus}
            audioEnabled={audioEnabled}
            onUnlockAudio={onUnlockAudio}
            onToggleAudio={onToggleAudio}
            recoveryToast={recoveryToast}
          />
        </main>

        {/* Subtle Escape Footer Link so presenter is NEVER trapped on their phone */}
        <footer className="py-5 px-4 text-center border-t border-slate-200/70 bg-white/50">
          <button
            type="button"
            onClick={() => setShowAdminModal(true)}
            className="text-[11px] font-medium text-slate-500 hover:text-slate-900 transition-colors"
          >
            فتح اللوحة الرئيسية (رمز الإدارة 1234)
          </button>
        </footer>

        {showAdminModal && (
          <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="glass-surface bg-white/95 rounded-2xl p-5 w-full max-w-xs space-y-4">
              <div>
                <h3 className="text-sm font-bold text-slate-900">الدخول إلى لوحة البوث الرئيسية</h3>
                <p className="text-xs text-slate-500 mt-1">أدخل رمز الإدارة للمتابعة</p>
              </div>
              <form onSubmit={handleAdminUnlock} className="space-y-3">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  dir="ltr"
                  value={adminPin}
                  onChange={(e) => {
                    setAdminPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    setAdminError('');
                  }}
                  placeholder="1234"
                  className="w-full py-2.5 px-3 rounded-xl border border-slate-200 text-center text-base font-bold tracking-[0.4em] tabular-nums focus:outline-none focus:border-slate-900"
                />
                {adminError && <p className="text-xs text-red-600">{adminError}</p>}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAdminModal(false);
                      setAdminPin('');
                      setAdminError('');
                    }}
                    className="py-2 rounded-xl bg-slate-100 text-xs font-semibold text-slate-700"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    className="py-2 rounded-xl bg-slate-900 text-xs font-semibold text-white"
                  >
                    دخول
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // EMBEDDED TAB 2 PREVIEW (معاينة موبايل ولي الأمر) — Realistic Phone Frame + Side Live Tester
  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Realistic Architectural Smartphone Frame */}
      <div className="lg:col-span-6 flex justify-center">
        <div className="w-full max-w-[390px] rounded-[42px] bg-[#0F172A] p-3 shadow-[0_24px_65px_rgba(15,23,42,0.18)] border border-slate-700/80">
          {/* Dynamic speaker bar */}
          <div className="flex justify-center pt-1.5 pb-2.5">
            <div className="w-24 h-1.5 rounded-full bg-slate-700" />
          </div>
          <div className="rounded-[32px] overflow-hidden bg-gradient-to-b from-[#EDF2F7] via-[#F4F7FA] to-[#F8FAFC] max-h-[700px] overflow-y-auto">
            <PhoneScreenContent
              band={band}
              standaloneMode={false}
              syncStatus={syncStatus}
              audioEnabled={audioEnabled}
              onUnlockAudio={onUnlockAudio}
              onToggleAudio={onToggleAudio}
              recoveryToast={recoveryToast}
            />
          </div>
        </div>
      </div>

      {/* Right Side Jury Live Demonstration Controls for Phone Preview */}
      <div className="lg:col-span-6 space-y-5">
        <div className="glass-surface rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">اختبار تفاعل هاتف ولي الأمر لحظياً</h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              جرّب إطلاق السيناريوهات التالية وشاهد استجابة شاشة هاتف ولي الأمر والصوت والتنبيه التلقائي في نفس اللحظة
            </p>
          </div>

          {onRunScenario && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => onRunScenario('safe_walk_kids')}
                className="flex items-center gap-2.5 p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-300 text-right transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-xs font-bold text-slate-900">تمشية آمنة لمنطقة الألعاب</span>
              </button>

              <button
                type="button"
                onClick={() => onRunScenario('breach_radius')}
                className="flex items-center gap-2.5 p-3.5 rounded-xl bg-white border border-slate-200 hover:border-amber-300 text-right transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-xs font-bold text-slate-900">ابتعاد وتجاوز نطاق الأمان</span>
              </button>

              <button
                type="button"
                onClick={() => onRunScenario('return_to_parent')}
                className="flex items-center gap-2.5 p-3.5 rounded-xl bg-white border border-slate-200 hover:border-teal-300 text-right transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-50 text-teal-700 flex items-center justify-center shrink-0">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-xs font-bold text-slate-900">عودة الطفل وإيقاف الإنذار</span>
              </button>

              <button
                type="button"
                onClick={() => onRunScenario('approach_exit')}
                className="flex items-center gap-2.5 p-3.5 rounded-xl bg-white border border-slate-200 hover:border-red-300 text-right transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-xs font-bold text-slate-900">اقتراب من بوابة الخروج</span>
              </button>

              <button
                type="button"
                onClick={() => onRunScenario('left_behind')}
                className="flex items-center gap-2.5 p-3.5 rounded-xl bg-white border border-slate-200 hover:border-amber-300 text-right transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-xs font-bold text-slate-900">سيناريو نسيان الطفل</span>
              </button>

              <button
                type="button"
                onClick={() => onRunScenario('tamper_attempt')}
                className="flex items-center gap-2.5 p-3.5 rounded-xl bg-white border border-slate-200 hover:border-red-300 text-right transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center shrink-0">
                  <Play className="w-3.5 h-3.5 fill-current" />
                </div>
                <span className="text-xs font-bold text-slate-900">محاولة فك السوار عشوائياً</span>
              </button>
            </div>
          )}

          {band?.tamperActive && onConfirmClaspLock && (
            <button
              type="button"
              onClick={onConfirmClaspLock}
              className="w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors"
            >
              تأكيد إحكام القفل وإيقاف الإنذار الأمني
            </button>
          )}
        </div>

        <div className="glass-surface rounded-2xl p-6 space-y-3">
          <h3 className="text-sm font-bold text-slate-900">عزل الصلاحيات والخصوصية</h3>
          <div className="space-y-2.5 text-xs text-slate-600 leading-relaxed">
            <p>
              عند مسح ولي الأمر لكود QR بكاميرا هاتفه الحقيقي، يفتح الرابط مباشرة في وضع المتابعة المعزول دون إظهار أي لوحات تحكم إدارية أو بيانات لأطفال آخرين
            </p>
            <p>
              يتم استلام التحديثات والإنذارات لحظياً عبر المزامنة المباشرة، ويتوقف صوت الإنذار والاهتزاز تلقائياً فور عودة الطفل داخل دائرة الأمان
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
