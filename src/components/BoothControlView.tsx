import React, { useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowDownLeft,
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpLeft,
  ArrowUpRight,
  BatteryCharging,
  Check,
  CheckCircle2,
  Copy,
  Crosshair,
  DoorOpen,
  ExternalLink,
  Footprints,
  KeyRound,
  Lock,
  LockOpen,
  Play,
  Plus,
  QrCode,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Unlock,
  UserCheck,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  EDITION_LIST,
  SAFE_RADIUS_PRESETS,
  WRISTBAND_EDITIONS,
  getZoneBadgeStatus,
} from '../data/mallConfig';
import { BandSession, EditionId, MobileRole, Point, ScenarioId } from '../types/safestep';
import { buildParentScanUrl, buildWristbandScanUrl } from '../utils/storage';
import { EditionBadge } from './EditionBadge';
import { QrCodeCanvas } from './QrCodeCanvas';
import { SmartMallMap } from './SmartMallMap';

interface BoothControlViewProps {
  bands: BandSession[];
  activeBand: BandSession | null;
  publicBaseUrl: string;
  onUpdatePublicBaseUrl: (url: string) => void;
  onSelectBand: (bandId: string) => void;
  onIssueBand: (childName: string, editionId: EditionId, safeRadius: number) => void;
  onMoveChild: (pos: Point) => void;
  onMoveParent: (pos: Point) => void;
  onStepChild: (dxMeters: number, dyMeters: number) => void;
  onUpdateSafeRadius: (radius: number) => void;
  onUpdateBattery: (battery: number) => void;
  onRunScenario: (scenario: ScenarioId) => void;
  runningScenario: ScenarioId | null;
  onConfirmClaspLock: () => void;
  onAcknowledgeLeftBehind: () => void;
  onResetTrail: () => void;
  onCalibrateZero: () => void;
  onCheckoutBand: (bandId: string, pin: string) => { ok: boolean; error?: string };
  audioEnabled: boolean;
  onToggleAudio: () => void;
  showIssueModal: boolean;
  onSetShowIssueModal: (open: boolean) => void;
  recoveryToast: string | null;
}

const SCENARIO_BUTTONS: Array<{
  id: ScenarioId;
  label: string;
  sublabel: string;
  tone: 'safe' | 'warning' | 'critical';
}> = [
  {
    id: 'safe_walk_kids',
    label: 'تمشية آمنة لمنطقة الألعاب',
    sublabel: 'رسم المسار داخل النطاق الآمن',
    tone: 'safe',
  },
  {
    id: 'breach_radius',
    label: 'ابتعاد وتجاوز نطاق الأمان',
    sublabel: 'تفعيل إنذار تجاوز المسافة فوراً',
    tone: 'warning',
  },
  {
    id: 'return_to_parent',
    label: 'عودة الطفل لولي الأمر',
    sublabel: 'إيقاف الإنذار تلقائياً عند العودة',
    tone: 'safe',
  },
  {
    id: 'approach_exit',
    label: 'اقتراب من بوابة الخروج',
    sublabel: 'تفعيل خط إنذار البوابة الفوري',
    tone: 'critical',
  },
  {
    id: 'left_behind',
    label: 'سيناريو نسيان الطفل في منطقة',
    sublabel: 'تنبيه البقاء المنفرد دون حركة',
    tone: 'warning',
  },
  {
    id: 'tamper_attempt',
    label: 'محاولة فك السوار عشوائياً',
    sublabel: 'إنذار أمني وحماية القفل الذكي',
    tone: 'critical',
  },
];

export const BoothControlView: React.FC<BoothControlViewProps> = ({
  bands,
  activeBand,
  publicBaseUrl,
  onUpdatePublicBaseUrl,
  onSelectBand,
  onIssueBand,
  onMoveChild,
  onMoveParent,
  onStepChild,
  onUpdateSafeRadius,
  onUpdateBattery,
  onRunScenario,
  runningScenario,
  onConfirmClaspLock,
  onAcknowledgeLeftBehind,
  onResetTrail,
  onCalibrateZero,
  onCheckoutBand,
  audioEnabled,
  onToggleAudio,
  showIssueModal,
  onSetShowIssueModal,
  recoveryToast,
}) => {
  // Issuance Form State
  const [childName, setChildName] = useState('');
  const [selectedEdition, setSelectedEdition] = useState<EditionId>('batman');
  const [issueRadius, setIssueRadius] = useState(6);
  const [issueError, setIssueError] = useState('');

  // QR Copy, Role Toggle & Edit URL State
  const [qrTargetRole, setQrTargetRole] = useState<MobileRole>('parent');
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [editingBaseUrl, setEditingBaseUrl] = useState(false);

  // Checkout PIN Verification State
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinShake, setPinShake] = useState(false);
  const [checkoutSuccess, setCheckoutSuccess] = useState('');

  const activeBands = bands.filter((b) => b.status === 'active');

  useEffect(() => {
    setPinInput('');
    setPinError('');
  }, [activeBand?.bandId]);

  const handleIssueSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleaned = childName.trim();
    if (cleaned.length < 2) {
      setIssueError('يرجى إدخال اسم الطفل أولاً');
      return;
    }
    setIssueError('');
    onIssueBand(cleaned, selectedEdition, issueRadius);
    setChildName('');
    onSetShowIssueModal(false);
  };

  const handleCheckoutSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeBand) return;
    const res = onCheckoutBand(activeBand.bandId, pinInput.trim());
    if (!res.ok) {
      setPinError(res.error || 'رمز التحقق غير صحيح');
      setPinShake(true);
      window.setTimeout(() => setPinShake(false), 450);
    } else {
      setPinInput('');
      setPinError('');
      setCheckoutSuccess(`تم تسليم السوار ${activeBand.bandId} وإنهاء الجلسة بنجاح`);
      window.setTimeout(() => setCheckoutSuccess(''), 4000);
    }
  };

  const scanUrl = activeBand
    ? qrTargetRole === 'parent'
      ? buildParentScanUrl(publicBaseUrl, activeBand.bandId)
      : buildWristbandScanUrl(publicBaseUrl, activeBand.bandId)
    : '';

  const isDualPhoneActive = Boolean(
    activeBand?.wristbandActiveAt && Date.now() - activeBand.wristbandActiveAt < 60000
  );

  const handleCopyScanUrl = () => {
    if (!scanUrl) return;
    navigator.clipboard?.writeText(scanUrl).catch(() => {});
    setCopiedUrl(true);
    window.setTimeout(() => setCopiedUrl(false), 2000);
  };

  const statusLevel = activeBand ? getZoneBadgeStatus(activeBand) : 'safe';

  return (
    <div className="space-y-6">
      {/* Recovery Toast Banner (4-second auto-clear confirmation) */}
      {recoveryToast && (
        <div className="glass-surface rounded-2xl px-5 py-3.5 border-teal-200 bg-teal-50/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-600/12 text-teal-700 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" strokeWidth={1.85} />
            </div>
            <p className="text-sm font-semibold text-teal-900">{recoveryToast}</p>
          </div>
        </div>
      )}

      {checkoutSuccess && (
        <div className="glass-surface rounded-2xl px-5 py-3.5 border-slate-200 bg-white/90 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-slate-900/8 text-slate-900 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" strokeWidth={1.85} />
          </div>
          <p className="text-sm font-semibold text-slate-900">{checkoutSuccess}</p>
        </div>
      )}

      {/* Active Wristbands Strip + Sound Switch */}
      <div className="glass-surface rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <span className="text-xs font-semibold text-slate-500 ml-1">الأساور النشطة حالياً</span>
          {activeBands.length === 0 ? (
            <span className="text-xs text-slate-400">لا توجد أساور نشطة</span>
          ) : (
            activeBands.map((b) => {
              const isSelected = b.bandId === activeBand?.bandId;
              const bStatus = getZoneBadgeStatus(b);
              return (
                <button
                  key={b.bandId}
                  type="button"
                  onClick={() => onSelectBand(b.bandId)}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap shrink-0 ${
                    isSelected
                      ? 'bg-slate-900 text-white shadow-sm'
                      : 'bg-white/80 text-slate-700 border border-slate-200/80 hover:bg-white'
                  }`}
                >
                  <span className="tabular-nums font-semibold">{b.bandId}</span>
                  <span aria-hidden="true" className={isSelected ? 'text-slate-400' : 'text-slate-300'}>
                    ·
                  </span>
                  <span>{b.childName}</span>
                  {bStatus !== 'safe' && (
                    <span
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
                        bStatus === 'critical'
                          ? 'bg-red-600 text-white'
                          : 'bg-amber-500 text-white'
                      }`}
                    >
                      تنبيه
                    </span>
                  )}
                </button>
              );
            })
          )}
          <button
            type="button"
            onClick={() => onSetShowIssueModal(!showIssueModal)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-900 bg-slate-100 hover:bg-slate-200/80 transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            <span>{showIssueModal ? 'إغلاق نموذج الإصدار' : 'إصدار سوار جديد'}</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onToggleAudio}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap shrink-0 ${
              audioEnabled
                ? 'bg-teal-50 text-teal-800 border border-teal-200/80'
                : 'bg-white/80 text-slate-600 border border-slate-200/80 hover:text-slate-900'
            }`}
          >
            {audioEnabled ? (
              <Volume2 className="w-4 h-4 text-teal-700" strokeWidth={1.85} />
            ) : (
              <VolumeX className="w-4 h-4 text-slate-500" strokeWidth={1.85} />
            )}
            <span>{audioEnabled ? 'صوت إنذار البوث مفعّل' : 'تفعيل صوت إنذار البوث'}</span>
          </button>
        </div>
      </div>

      {/* Collapsible Quick Wristband Issuance Drawer */}
      {(showIssueModal || !activeBand) && (
        <section className="glass-surface rounded-2xl p-6">
          <div className="flex items-center justify-between gap-4 mb-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">إصدار وتفعيل سوار ذكي جديد</h2>
              <p className="text-xs text-slate-500 mt-1">
                اختر تصميم السيليكون المحبب للطفل وحدد نطاق الأمان لإصدار كود التتبع ورمز التسليم فوراً
              </p>
            </div>
            {activeBand && (
              <button
                type="button"
                onClick={() => onSetShowIssueModal(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200/80 flex items-center justify-center text-slate-600 transition-colors"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <form onSubmit={handleIssueSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">اسم الطفل</label>
                <input
                  type="text"
                  value={childName}
                  onChange={(e) => setChildName(e.target.value)}
                  placeholder="مثال: ليان أحمد"
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-slate-900 transition-colors"
                />
                {issueError && <p className="text-xs text-red-600 mt-1.5">{issueError}</p>}
              </div>

              <div>
                <div className="flex items-center justify-between text-xs mb-2">
                  <label className="font-semibold text-slate-700">نطاق الأمان الافتراضي</label>
                  <span className="font-bold text-slate-900 tabular-nums">{issueRadius} متر</span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={35}
                  step={1}
                  value={issueRadius}
                  onChange={(e) => setIssueRadius(Number(e.target.value))}
                  className="w-full arch-slider"
                />
                <div className="flex justify-between text-[11px] text-slate-400 mt-1 tabular-nums">
                  <span>4 م</span>
                  <span>15 م</span>
                  <span>35 م</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 flex flex-col justify-between gap-4">
              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-2">
                  تصميم السوار السيليكوني الآمن للبشرة
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {EDITION_LIST.map((ed) => {
                    const active = selectedEdition === ed.id;
                    return (
                      <button
                        key={ed.id}
                        type="button"
                        onClick={() => setSelectedEdition(ed.id)}
                        className={`flex items-center gap-3 p-3 rounded-xl text-right transition-all ${
                          active
                            ? 'bg-slate-900 text-white shadow-sm'
                            : 'bg-white/80 text-slate-800 border border-slate-200/90 hover:bg-white'
                        }`}
                      >
                        <EditionBadge editionId={ed.id} size="sm" />
                        <div className="min-w-0">
                          <div className="text-xs font-bold truncate">{ed.name}</div>
                          <div
                            className={`text-[11px] truncate mt-0.5 ${
                              active ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            {ed.subtitle}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end">
                <button
                  type="submit"
                  className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
                >
                  <Lock className="w-4 h-4" strokeWidth={1.85} />
                  <span>تفعيل القفل الذكي وإصدار الكود</span>
                </button>
              </div>
            </div>
          </form>
        </section>
      )}

      {/* Main Live Control Workspace */}
      {activeBand && (
        <>
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            {/* Primary Focal Anchor (8 cols): Live Smart Mall Map + Alerts + Metrics */}
            <div className="xl:col-span-8 space-y-4">
              {/* Active Live Alerts Stack */}
              {activeBand.activeAlerts.length > 0 && (
                <div className="space-y-2.5">
                  {activeBand.activeAlerts.map((alert) => {
                    const isCritical = alert.severity === 'critical';
                    return (
                      <div
                        key={alert.type}
                        className={`rounded-2xl px-4 py-3.5 flex flex-wrap items-center justify-between gap-3 border ${
                          isCritical
                            ? 'bg-red-50/95 border-red-200 text-red-950'
                            : 'bg-amber-50/95 border-amber-200 text-amber-950'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <div
                            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                              isCritical
                                ? 'bg-red-600 text-white'
                                : 'bg-amber-500 text-white'
                            }`}
                          >
                            {alert.type === 'EXIT_GATE_ALERT' ? (
                              <DoorOpen className="w-5 h-5" strokeWidth={1.85} />
                            ) : alert.type === 'TAMPER_LOCK_ALERT' ? (
                              <LockOpen className="w-5 h-5" strokeWidth={1.85} />
                            ) : (
                              <AlertTriangle className="w-5 h-5" strokeWidth={1.85} />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="text-sm font-bold">{alert.title}</div>
                            <div className="text-xs opacity-85 mt-0.5">{alert.message}</div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {alert.type === 'TAMPER_LOCK_ALERT' && (
                            <button
                              type="button"
                              onClick={onConfirmClaspLock}
                              className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold whitespace-nowrap transition-colors"
                            >
                              تأكيد إحكام القفل
                            </button>
                          )}
                          {alert.type === 'LEFT_BEHIND_ALERT' && (
                            <button
                              type="button"
                              onClick={onAcknowledgeLeftBehind}
                              className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold whitespace-nowrap transition-colors"
                            >
                              تأكيد الوصول للطفل
                            </button>
                          )}
                          {(alert.type === 'DISTANCE_BREACH' || alert.type === 'EXIT_GATE_ALERT') && (
                            <button
                              type="button"
                              onClick={() => onRunScenario('return_to_parent')}
                              className="px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold whitespace-nowrap transition-colors"
                            >
                              إعادة الطفل للنطاق الآمن
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Architectural Smart Mall Floorplan Container */}
              <div className="glass-surface rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <EditionBadge editionId={activeBand.editionId} size="md" />
                    <div>
                      <div className="flex items-center gap-2">
                        <h1 className="text-base sm:text-lg font-bold text-slate-900">
                          {activeBand.childName}
                        </h1>
                        <span className="text-xs text-slate-400 tabular-nums">
                          {activeBand.bandId}
                        </span>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-0.5">
                        <span>{WRISTBAND_EDITIONS[activeBand.editionId].name}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            activeBand.claspLocked
                              ? 'text-teal-700 font-medium'
                              : 'text-red-600 font-semibold'
                          }
                        >
                          {activeBand.claspLocked
                            ? 'القفل مؤمّن ضد الفك'
                            : 'تحذير: محاولة فك القفل'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-semibold">
                    <span
                      className={`flex items-center gap-1.5 ${
                        statusLevel === 'critical'
                          ? 'text-red-600'
                          : statusLevel === 'warning'
                            ? 'text-amber-600'
                            : 'text-teal-700'
                      }`}
                    >
                      {statusLevel === 'safe' ? (
                        <ShieldCheck className="w-4 h-4" strokeWidth={1.9} />
                      ) : (
                        <ShieldAlert className="w-4 h-4" strokeWidth={1.9} />
                      )}
                      <span>
                        {statusLevel === 'critical'
                          ? 'حالة إنذار أمني فوري'
                          : statusLevel === 'warning'
                            ? 'تنبيه نطاق الأمان'
                            : 'الوضع آمن ومستقر'}
                      </span>
                    </span>
                  </div>
                </div>

                {/* Jury Hall Distance Presets + One-Tap Zero Calibration Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2.5 py-2.5 px-3 rounded-xl bg-slate-100/80 border border-slate-200/70">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {SAFE_RADIUS_PRESETS.map((preset) => {
                      const active = activeBand.safeRadius === preset.radius;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => onUpdateSafeRadius(preset.radius)}
                          className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all whitespace-nowrap ${
                            active
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'bg-white/90 text-slate-700 hover:bg-white border border-slate-200/80'
                          }`}
                        >
                          {preset.label}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={onCalibrateZero}
                    className="px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-[11px] font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <Crosshair className="w-3.5 h-3.5" strokeWidth={2} />
                    <span>معايرة نقطة الصفر هنا (0 متر)</span>
                  </button>
                </div>

                {/* Bespoke 2.5D Smart Mall Map */}
                <SmartMallMap
                  band={activeBand}
                  onMoveChild={onMoveChild}
                  onMoveParent={onMoveParent}
                />

                {/* Clean 4-Metric Architectural Strip (Unboxed, Hairline Dividers) */}
                <div className="grid grid-cols-2 sm:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x sm:divide-x-reverse divide-slate-200/80 pt-1">
                  <div className="py-2 sm:px-3 first:pr-0">
                    <div className="text-[11px] text-slate-500">المسافة عن ولي الأمر</div>
                    <div
                      className={`text-lg font-bold tabular-nums mt-0.5 ${
                        activeBand.distanceMeters > activeBand.safeRadius
                          ? 'text-red-600'
                          : 'text-slate-900'
                      }`}
                    >
                      {activeBand.distanceMeters.toFixed(1)} متر
                    </div>
                  </div>

                  <div className="py-2 sm:px-3">
                    <div className="text-[11px] text-slate-500">خطوات الطفل المسجلة</div>
                    <div className="text-lg font-bold text-slate-900 tabular-nums mt-0.5 flex items-center gap-1.5">
                      <Footprints className="w-4 h-4 text-teal-700" strokeWidth={1.8} />
                      <span>{activeBand.stepCount}</span>
                    </div>
                  </div>

                  <div className="py-2 sm:px-3">
                    <div className="text-[11px] text-slate-500">حالة القفل الإلكتروني</div>
                    <div
                      className={`text-sm font-bold mt-1.5 flex items-center gap-1.5 ${
                        activeBand.claspLocked ? 'text-teal-700' : 'text-red-600'
                      }`}
                    >
                      {activeBand.claspLocked ? (
                        <Lock className="w-4 h-4" strokeWidth={1.85} />
                      ) : (
                        <Unlock className="w-4 h-4" strokeWidth={1.85} />
                      )}
                      <span>{activeBand.claspLocked ? 'مُحكم ومغلق' : 'إنذار فك'}</span>
                    </div>
                  </div>

                  <div className="py-2 sm:px-3">
                    <div className="text-[11px] text-slate-500">بطارية السوار</div>
                    <div
                      className={`text-lg font-bold tabular-nums mt-0.5 flex items-center gap-1.5 ${
                        activeBand.battery <= 20 ? 'text-amber-600' : 'text-slate-900'
                      }`}
                    >
                      <BatteryCharging className="w-4 h-4 text-slate-500" strokeWidth={1.8} />
                      <span>{activeBand.battery}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (4 cols): Instant QR Scan Card + 4-Digit Return PIN Checkout */}
            <div className="xl:col-span-4 space-y-5">
              {/* Instant Cross-Device QR Scan Card (Supports 1-Phone + Laptop OR 2-Phone Demo) */}
              <div className="glass-surface rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-slate-900/8 text-slate-900 flex items-center justify-center shrink-0">
                      <QrCode className="w-4 h-4" strokeWidth={1.85} />
                    </div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-900">أكواد الربط المباشر للهواتف</h2>
                      <p className="text-[11px] text-slate-500">
                        {isDualPhoneActive
                          ? 'وضع موبايلين نشط: قياس المسافة بين الهاتفين'
                          : 'وضع موبايل واحد مع اللاب: امسح وامشِ للتحرك المباشر'}
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-900 tabular-nums">
                    {activeBand.bandId}
                  </span>
                </div>

                {/* 2-Way QR Mode Toggle (Parent Phone ?p= vs Child Wristband Phone ?w=) */}
                <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100">
                  <button
                    type="button"
                    onClick={() => setQrTargetRole('parent')}
                    className={`py-2 px-2 rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      qrTargetRole === 'parent'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">كود الهاتف الأول (ولي الأمر)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setQrTargetRole('wristband')}
                    className={`py-2 px-2 rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                      qrTargetRole === 'wristband'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Smartphone className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">كود هاتف السوار (لو معك موبايلين)</span>
                  </button>
                </div>

                <div className="flex flex-col items-center justify-center py-4 px-3 rounded-xl bg-white border border-slate-200/80">
                  <QrCodeCanvas value={scanUrl} size={172} />
                  <p className="text-xs font-semibold text-slate-800 mt-3">
                    {qrTargetRole === 'parent'
                      ? `امسح لربط هاتف ولي الأمر (${activeBand.childName})`
                      : `امسح لتحويل الهاتف الثاني إلى سوار (${activeBand.childName})`}
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                    رمز التسليم الخاص: {activeBand.returnPin}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={handleCopyScanUrl}
                    className="py-2.5 px-3 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    {copiedUrl ? (
                      <Check className="w-3.5 h-3.5 text-teal-700" strokeWidth={2} />
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-500" strokeWidth={1.8} />
                    )}
                    <span>{copiedUrl ? 'تم نسخ الرابط' : 'نسخ رابط الهاتف'}</span>
                  </button>

                  <a
                    href={scanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="py-2.5 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-white flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                  >
                    <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.8} />
                    <span>{qrTargetRole === 'parent' ? 'فتح هاتف ولي الأمر' : 'فتح هاتف السوار'}</span>
                  </a>
                </div>

                {/* Editable Public URL for real smartphone demo */}
                <div className="pt-2 border-t border-slate-200/70">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-slate-500">رابط الموقع العام للكود</span>
                    <button
                      type="button"
                      onClick={() => setEditingBaseUrl(!editingBaseUrl)}
                      className="text-slate-800 font-semibold hover:underline"
                    >
                      {editingBaseUrl ? 'تم' : 'تعديل الرابط'}
                    </button>
                  </div>
                  {editingBaseUrl ? (
                    <input
                      type="url"
                      dir="ltr"
                      value={publicBaseUrl}
                      onChange={(e) => onUpdatePublicBaseUrl(e.target.value)}
                      className="mt-2 w-full px-3 py-2 rounded-lg bg-white border border-slate-200 text-[11px] text-slate-700 font-mono focus:outline-none focus:border-slate-900"
                    />
                  ) : (
                    <p
                      dir="ltr"
                      className="mt-1 text-[11px] text-slate-400 truncate font-mono text-left"
                    >
                      {scanUrl}
                    </p>
                  )}
                </div>
              </div>

              {/* Official 4-Digit Return PIN Checkout Card */}
              <div className="glass-surface rounded-2xl p-5 space-y-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-teal-600/10 text-teal-800 flex items-center justify-center shrink-0">
                    <KeyRound className="w-4 h-4" strokeWidth={1.85} />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">إنهاء الجلسة وتسليم السوار</h2>
                    <p className="text-[11px] text-slate-500">
                      يتطلب التحقق من رمز التسليم المكون من 4 أرقام
                    </p>
                  </div>
                </div>

                <form onSubmit={handleCheckoutSubmit} className="space-y-3">
                  <div className={pinShake ? 'animate-pin-shake' : ''}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={4}
                      dir="ltr"
                      value={pinInput}
                      onChange={(e) => {
                        setPinInput(e.target.value.replace(/\D/g, '').slice(0, 4));
                        setPinError('');
                      }}
                      placeholder="••••"
                      className={`w-full py-3 px-4 rounded-xl bg-white border text-center text-lg font-bold tracking-[0.45em] tabular-nums focus:outline-none transition-colors ${
                        pinError
                          ? 'border-red-400 text-red-700 bg-red-50/40'
                          : 'border-slate-200 text-slate-900 focus:border-slate-900'
                      }`}
                    />
                  </div>

                  {pinError && (
                    <p className="text-xs font-medium text-red-600">{pinError}</p>
                  )}

                  {activeBand.tamperActive && (
                    <p className="text-[11px] text-red-700 bg-red-50 border border-red-200/80 rounded-xl px-3 py-2">
                      يجب تأكيد إحكام القفل الأمني قبل إتمام تسليم السوار
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={pinInput.length !== 4 || activeBand.tamperActive}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:bg-slate-300 disabled:text-slate-500 text-white text-xs font-semibold transition-colors"
                  >
                    تحقق من الرمز وفك القفل للتسليم
                  </button>
                </form>
              </div>
            </div>
          </div>

          {/* Full Jury Presentation Control Deck */}
          <section className="glass-surface rounded-2xl p-5 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-slate-900/8 text-slate-900 flex items-center justify-center shrink-0">
                  <SlidersHorizontal className="w-5 h-5" strokeWidth={1.8} />
                </div>
                <div>
                  <h2 className="text-base font-bold text-slate-900">لوحة تحكم العرض أمام اللجنة</h2>
                  <p className="text-xs text-slate-500">
                    سيناريوهات حركة سلسة بضغطة واحدة وتحكم دقيق في المسار والنطاق الآمن
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onResetTrail}
                className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-800 flex items-center gap-2 transition-colors whitespace-nowrap"
              >
                <RotateCcw className="w-3.5 h-3.5 text-slate-600" strokeWidth={1.85} />
                <span>إعادة ضبط المسار لتجربة جديدة</span>
              </button>
            </div>

            {/* 6 One-Click Animated Scenarios */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {SCENARIO_BUTTONS.map((sc) => {
                const isRunning = runningScenario === sc.id;
                const accentBorder =
                  sc.tone === 'critical'
                    ? 'hover:border-red-300'
                    : sc.tone === 'warning'
                      ? 'hover:border-amber-300'
                      : 'hover:border-teal-300';
                const iconTone =
                  sc.tone === 'critical'
                    ? 'bg-red-50 text-red-600'
                    : sc.tone === 'warning'
                      ? 'bg-amber-50 text-amber-700'
                      : 'bg-teal-50 text-teal-700';

                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => onRunScenario(sc.id)}
                    className={`group flex items-center gap-3 p-3.5 rounded-xl bg-white/85 border text-right transition-all ${
                      isRunning
                        ? 'border-slate-900 ring-1 ring-slate-900/15 bg-white'
                        : `border-slate-200/80 ${accentBorder} hover:bg-white`
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${iconTone}`}
                    >
                      <Play className="w-4 h-4 fill-current" strokeWidth={1.5} />
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold text-slate-900 truncate">{sc.label}</div>
                      <div className="text-[11px] text-slate-500 truncate mt-0.5">{sc.sublabel}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Fine Controls Row: 8-Way Step Pad + Safe Radius Slider + Battery Slider */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 pt-4 border-t border-slate-200/75 items-center">
              {/* 8-Way Directional Step Pad (+1m) */}
              <div className="lg:col-span-4 flex items-center gap-4">
                <div className="grid grid-cols-3 gap-1.5 shrink-0" dir="ltr">
                  <button
                    type="button"
                    onClick={() => onStepChild(-1.5, -1.5)}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-900 hover:text-white flex items-center justify-center text-slate-700 transition-colors"
                    aria-label="تحريك شمال غرب"
                  >
                    <ArrowUpLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onStepChild(0, -1.5)}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-900 hover:text-white flex items-center justify-center text-slate-700 transition-colors"
                    aria-label="تحريك للأعلى"
                  >
                    <ArrowUp className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onStepChild(1.5, -1.5)}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-900 hover:text-white flex items-center justify-center text-slate-700 transition-colors"
                    aria-label="تحريك شمال شرق"
                  >
                    <ArrowUpRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onStepChild(-1.5, 0)}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-900 hover:text-white flex items-center justify-center text-slate-700 transition-colors"
                    aria-label="تحريك لليسار"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-bold text-slate-600 tabular-nums">
                    +1م
                  </div>
                  <button
                    type="button"
                    onClick={() => onStepChild(1.5, 0)}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-900 hover:text-white flex items-center justify-center text-slate-700 transition-colors"
                    aria-label="تحريك لليمين"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onStepChild(-1.5, 1.5)}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-900 hover:text-white flex items-center justify-center text-slate-700 transition-colors"
                    aria-label="تحريك جنوب غرب"
                  >
                    <ArrowDownLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onStepChild(0, 1.5)}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-900 hover:text-white flex items-center justify-center text-slate-700 transition-colors"
                    aria-label="تحريك للأسفل"
                  >
                    <ArrowDown className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => onStepChild(1.5, 1.5)}
                    className="w-10 h-10 rounded-xl bg-white border border-slate-200 hover:bg-slate-900 hover:text-white flex items-center justify-center text-slate-700 transition-colors"
                    aria-label="تحريك جنوب شرق"
                  >
                    <ArrowDownRight className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-900">التحريك الدقيق للطفل</div>
                  <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                    حرّك الطفل في 8 اتجاهات بخطوات ثابتة أو اسحبه مباشرة على الخريطة
                  </p>
                </div>
              </div>

              {/* Safe Radius Slider */}
              <div className="lg:col-span-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">تعديل دائرة نطاق الأمان</span>
                  <span className="font-bold text-teal-800 tabular-nums">
                    {activeBand.safeRadius} متر
                  </span>
                </div>
                <input
                  type="range"
                  min={4}
                  max={35}
                  step={1}
                  value={activeBand.safeRadius}
                  onChange={(e) => onUpdateSafeRadius(Number(e.target.value))}
                  className="w-full arch-slider"
                />
                <div className="flex justify-between text-[11px] text-slate-400 tabular-nums">
                  <span>4 م</span>
                  <span>15 م</span>
                  <span>35 م</span>
                </div>
              </div>

              {/* Battery Level Slider */}
              <div className="lg:col-span-4 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-slate-700">مستوى شحن بطارية السوار</span>
                  <span className="font-bold text-slate-900 tabular-nums">{activeBand.battery}%</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={100}
                  step={1}
                  value={activeBand.battery}
                  onChange={(e) => onUpdateBattery(Number(e.target.value))}
                  className="w-full arch-slider"
                />
                <div className="flex justify-between text-[11px] text-slate-400 tabular-nums">
                  <span>5%</span>
                  <span>50%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
};
