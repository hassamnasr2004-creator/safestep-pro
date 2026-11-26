import { ActiveAlert, AlertType, BandSession, EditionId, Point } from '../types/safestep';

export const MALL_WIDTH = 1000;
export const MALL_HEIGHT = 620;
export const PIXELS_PER_METER = 12; // 1000px ~= 83m width, 620px ~= 52m height
export const EXIT_GATE_THRESHOLD_METERS = 4;
export const MAX_TRAIL_POINTS = 140;

export interface EditionMeta {
  id: EditionId;
  name: string;
  subtitle: string;
  strapColor: string;
  accentColor: string;
  tintBg: string;
  borderColor: string;
  textColor: string;
}

export const WRISTBAND_EDITIONS: Record<EditionId, EditionMeta> = {
  batman: {
    id: 'batman',
    name: 'إصدار باتمان',
    subtitle: 'سيليكون طبي رمادي داكن',
    strapColor: '#1E293B',
    accentColor: '#B45309',
    tintBg: 'rgba(15, 23, 42, 0.08)',
    borderColor: 'rgba(15, 23, 42, 0.22)',
    textColor: '#0F172A',
  },
  spiderman: {
    id: 'spiderman',
    name: 'إصدار سبايدرمان',
    subtitle: 'سيليكون طبي قرمزي وكحلي',
    strapColor: '#B91C1C',
    accentColor: '#1D4ED8',
    tintBg: 'rgba(185, 28, 28, 0.08)',
    borderColor: 'rgba(185, 28, 28, 0.22)',
    textColor: '#991B1B',
  },
  space: {
    id: 'space',
    name: 'إصدار مستكشف الفضاء',
    subtitle: 'سيليكون طبي نيلي وفيروزي',
    strapColor: '#0F766E',
    accentColor: '#0F172A',
    tintBg: 'rgba(13, 148, 136, 0.09)',
    borderColor: 'rgba(13, 148, 136, 0.24)',
    textColor: '#115E59',
  },
  ice: {
    id: 'ice',
    name: 'إصدار أميرة الجليد',
    subtitle: 'سيليكون طبي ثلجي وفضي',
    strapColor: '#0284C7',
    accentColor: '#38BDF8',
    tintBg: 'rgba(2, 132, 199, 0.09)',
    borderColor: 'rgba(2, 132, 199, 0.24)',
    textColor: '#075985',
  },
};

export const EDITION_LIST: EditionMeta[] = [
  WRISTBAND_EDITIONS.batman,
  WRISTBAND_EDITIONS.spiderman,
  WRISTBAND_EDITIONS.space,
  WRISTBAND_EDITIONS.ice,
];

export interface MallSector {
  id: string;
  name: string;
  enName: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fill: string;
  activeFill: string;
}

export const MALL_SECTORS: MallSector[] = [
  {
    id: 'kids_arena',
    name: 'منطقة ألعاب الأطفال',
    enName: 'Kids Arena',
    x: 615,
    y: 55,
    w: 325,
    h: 195,
    fill: '#EEF6F5',
    activeFill: '#DDF2EE',
  },
  {
    id: 'food_court',
    name: 'منطقة المطاعم',
    enName: 'Food Court',
    x: 60,
    y: 55,
    w: 325,
    h: 195,
    fill: '#F7F3EC',
    activeFill: '#F2E8D8',
  },
  {
    id: 'family_retail_east',
    name: 'المتاجر العائلية والسينما',
    enName: 'Family Retail & Cinema',
    x: 615,
    y: 370,
    w: 325,
    h: 195,
    fill: '#F1F4F9',
    activeFill: '#E2E9F5',
  },
  {
    id: 'family_retail_west',
    name: 'المتاجر العائلية والسينما',
    enName: 'Family Retail & Cinema',
    x: 60,
    y: 370,
    w: 325,
    h: 195,
    fill: '#F1F4F9',
    activeFill: '#E2E9F5',
  },
  {
    id: 'central_booth',
    name: 'البوث الذكي - نقطة الأمان',
    enName: 'SafeStep Central Hub',
    x: 425,
    y: 266,
    w: 150,
    h: 88,
    fill: '#FFFFFF',
    activeFill: '#ECFDF5',
  },
];

export interface MallGate {
  id: string;
  name: string;
  directionLabel: string;
  x: number;
  y: number;
  lineX1: number;
  lineY1: number;
  lineX2: number;
  lineY2: number;
  orientation: 'horizontal' | 'vertical';
}

export const MALL_GATES: MallGate[] = [
  {
    id: 'gate_1',
    name: 'بوابة 1',
    directionLabel: 'المدخل الشمالي',
    x: 500,
    y: 36,
    lineX1: 446,
    lineY1: 42,
    lineX2: 554,
    lineY2: 42,
    orientation: 'horizontal',
  },
  {
    id: 'gate_2',
    name: 'بوابة 2',
    directionLabel: 'المدخل الشرقي',
    x: 964,
    y: 310,
    lineX1: 958,
    lineY1: 266,
    lineX2: 958,
    lineY2: 354,
    orientation: 'vertical',
  },
  {
    id: 'gate_3',
    name: 'بوابة 3',
    directionLabel: 'المدخل الجنوبي',
    x: 500,
    y: 584,
    lineX1: 446,
    lineY1: 578,
    lineX2: 554,
    lineY2: 578,
    orientation: 'horizontal',
  },
  {
    id: 'gate_4',
    name: 'بوابة 4',
    directionLabel: 'المدخل الغربي',
    x: 36,
    y: 310,
    lineX1: 42,
    lineY1: 266,
    lineX2: 42,
    lineY2: 354,
    orientation: 'vertical',
  },
];

export const SAFE_RADIUS_PRESETS = [
  { id: 'jury', label: 'وضع قاعة العرض (6 متر)', shortLabel: 'قاعة العرض 6م', radius: 6 },
  { id: 'medium', label: 'وضع المول المتوسط (15 متر)', shortLabel: 'مول متوسط 15م', radius: 15 },
  { id: 'large', label: 'وضع المول الكبير (25 متر)', shortLabel: 'مول كبير 25م', radius: 25 },
] as const;

export const DEFAULT_PARENT_POS: Point = { x: 500, y: 318 };
export const DEFAULT_CHILD_POS: Point = { x: 518, y: 306 };

export const ZERO_CALIBRATED_OFFSET: Point = { x: 6, y: 0 }; // 0.5m separation at zero point

export function clampToMall(p: Point): Point {
  return {
    x: Math.max(46, Math.min(MALL_WIDTH - 46, Math.round(p.x))),
    y: Math.max(46, Math.min(MALL_HEIGHT - 46, Math.round(p.y))),
  };
}

export function distancePx(a: Point, b: Point): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function distanceMeters(a: Point, b: Point): number {
  return Number((distancePx(a, b) / PIXELS_PER_METER).toFixed(1));
}

export function detectMallZone(pos: Point): string {
  // Check Central Hub first
  const booth = MALL_SECTORS.find((s) => s.id === 'central_booth')!;
  if (
    pos.x >= booth.x &&
    pos.x <= booth.x + booth.w &&
    pos.y >= booth.y &&
    pos.y <= booth.y + booth.h
  ) {
    return booth.name;
  }

  for (const sector of MALL_SECTORS) {
    if (sector.id === 'central_booth') continue;
    if (
      pos.x >= sector.x &&
      pos.x <= sector.x + sector.w &&
      pos.y >= sector.y &&
      pos.y <= sector.y + sector.h
    ) {
      return sector.name;
    }
  }

  // Check proximity to gates
  const nearest = findNearestGate(pos);
  if (nearest.meters <= EXIT_GATE_THRESHOLD_METERS) {
    return `نطاق ${nearest.gate.name}`;
  }

  return 'الممر التجاري الرئيسي';
}

export function findNearestGate(pos: Point): { gate: MallGate; meters: number } {
  let closest = MALL_GATES[0];
  let minMeters = distanceMeters(pos, { x: closest.x, y: closest.y });
  for (let i = 1; i < MALL_GATES.length; i++) {
    const g = MALL_GATES[i];
    const m = distanceMeters(pos, { x: g.x, y: g.y });
    if (m < minMeters) {
      minMeters = m;
      closest = g;
    }
  }
  return { gate: closest, meters: minMeters };
}

/**
 * Deterministic alert evaluation + Automatic Recovery engine.
 * Never produces random jumps; clears DISTANCE_BREACH and EXIT_GATE_ALERT immediately upon returning to safety.
 */
export function evaluateBandSession(
  prev: BandSession,
  updates: Partial<BandSession> = {},
  options?: { appendTrail?: boolean }
): BandSession {
  const now = Date.now();
  const nextParent = clampToMall(updates.parentPos ?? prev.parentPos);
  const nextChild = clampToMall(updates.childPos ?? prev.childPos);
  const safeRadius = updates.safeRadius ?? prev.safeRadius;
  const tamperActive = updates.tamperActive ?? prev.tamperActive;
  let leftBehindActive = updates.leftBehindActive ?? prev.leftBehindActive;

  // Deterministic step increment based solely on real child movement
  const movedPx = distancePx(prev.childPos, nextChild);
  let nextStepCount = updates.stepCount ?? prev.stepCount;
  let nextTrail = updates.trail ?? prev.trail;

  if (movedPx >= 0.5 && updates.stepCount === undefined) {
    const deltaMeters = movedPx / PIXELS_PER_METER;
    // Approx 1.45 child steps per meter moved
    const deltaSteps = Math.max(0, Math.round(deltaMeters * 1.45));
    nextStepCount = prev.stepCount + deltaSteps;
  }

  if (options?.appendTrail !== false && movedPx >= 6 && updates.trail === undefined) {
    const lastPt = nextTrail[nextTrail.length - 1];
    if (!lastPt || distancePx(lastPt, nextChild) >= 8) {
      const appended = [...nextTrail, nextChild];
      nextTrail =
        appended.length > MAX_TRAIL_POINTS
          ? appended.slice(appended.length - MAX_TRAIL_POINTS)
          : appended;
    }
  }

  const dist = distanceMeters(nextParent, nextChild);
  const currentZone = detectMallZone(nextChild);
  const { gate: nearestGate, meters: nearestGateMeters } = findNearestGate(nextChild);

  // Auto-clear Left Behind if parent & child reunite closely
  if (leftBehindActive && updates.leftBehindActive === undefined && dist <= Math.min(7, safeRadius * 0.55)) {
    leftBehindActive = false;
  }

  const prevTypes = new Set<AlertType>(prev.activeAlerts.map((a) => a.type));
  const prevByType = new Map<AlertType, ActiveAlert>(prev.activeAlerts.map((a) => [a.type, a]));

  const nextAlerts: ActiveAlert[] = [];

  // Alert D: Tamper Lock Alert (Highest priority security alarm)
  if (tamperActive) {
    const existing = prevByType.get('TAMPER_LOCK_ALERT');
    nextAlerts.push({
      type: 'TAMPER_LOCK_ALERT',
      title: 'إنذار أمني: محاولة فك السوار',
      message: 'إنذار أمني: محاولة فك السوار بدون تصريح',
      severity: 'critical',
      triggeredAt: existing ? existing.triggeredAt : now,
      zoneName: currentZone,
    });
  }

  // Alert B: Exit Gate Proximity Alert (<= 4m)
  if (nearestGateMeters <= EXIT_GATE_THRESHOLD_METERS) {
    const existing = prevByType.get('EXIT_GATE_ALERT');
    nextAlerts.push({
      type: 'EXIT_GATE_ALERT',
      title: `تحذير بوابة خروج (${nearestGate.name})`,
      message: `تحذير فوري: الطفل يقترب من ${nearestGate.name}`,
      severity: 'critical',
      triggeredAt: existing ? existing.triggeredAt : now,
      gateName: nearestGate.name,
      zoneName: currentZone,
    });
  }

  // Alert A: Safe Radius Distance Breach
  if (dist > safeRadius) {
    const existing = prevByType.get('DISTANCE_BREACH');
    nextAlerts.push({
      type: 'DISTANCE_BREACH',
      title: 'تجاوز النطاق الآمن',
      message: `تجاوز الطفل المسافة الآمنة (${dist.toFixed(1)} م من أصل ${safeRadius} م)`,
      severity: 'warning',
      triggeredAt: existing ? existing.triggeredAt : now,
      zoneName: currentZone,
    });
  }

  // Alert C: Left Behind / Unattended Alert
  if (leftBehindActive) {
    const existing = prevByType.get('LEFT_BEHIND_ALERT');
    nextAlerts.push({
      type: 'LEFT_BEHIND_ALERT',
      title: 'تنبيه البقاء المنفرد',
      message: `تنبيه النسيان: الطفل بمفرده دون حركة في ${currentZone}`,
      severity: 'warning',
      triggeredAt: existing ? existing.triggeredAt : now,
      zoneName: currentZone,
    });
  }

  // Check if any NEW alert appeared (to generate fresh unique alertTimestamp for reliable mobile sound/vibrate)
  let lastAlertTimestamp = updates.lastAlertTimestamp ?? prev.lastAlertTimestamp;
  const hasNewAlert = nextAlerts.some((a) => !prevTypes.has(a.type));
  if (hasNewAlert) {
    lastAlertTimestamp = now;
  }

  // Check AUTO-RECOVERY transitions
  let lastRecoveredAt = updates.lastRecoveredAt ?? prev.lastRecoveredAt;
  let recoveredMessage = updates.recoveredMessage ?? prev.recoveredMessage;

  const hadDistance = prevTypes.has('DISTANCE_BREACH');
  const hadGate = prevTypes.has('EXIT_GATE_ALERT');
  const hadLeftBehind = prevTypes.has('LEFT_BEHIND_ALERT');
  const hadTamper = prevTypes.has('TAMPER_LOCK_ALERT');

  const hasDistance = nextAlerts.some((a) => a.type === 'DISTANCE_BREACH');
  const hasGate = nextAlerts.some((a) => a.type === 'EXIT_GATE_ALERT');
  const hasLeftBehind = nextAlerts.some((a) => a.type === 'LEFT_BEHIND_ALERT');
  const hasTamper = nextAlerts.some((a) => a.type === 'TAMPER_LOCK_ALERT');

  if ((hadDistance && !hasDistance) || (hadGate && !hasGate) || (hadLeftBehind && !hasLeftBehind)) {
    if (nextAlerts.length === 0) {
      lastRecoveredAt = now;
      recoveredMessage = hadGate && !hadDistance
        ? 'ابتعد الطفل عن بوابة الخروج — تم إيقاف الإنذار تلقائياً'
        : 'عاد الطفل إلى النطاق الآمن — تم إيقاف الإنذار تلقائياً';
    }
  } else if (hadTamper && !hasTamper && nextAlerts.length === 0) {
    lastRecoveredAt = now;
    recoveredMessage = 'تم تأكيد إحكام القفل الذكي وإيقاف الإنذار';
  }

  return {
    ...prev,
    ...updates,
    parentPos: nextParent,
    childPos: nextChild,
    safeRadius,
    claspLocked: !tamperActive,
    tamperActive,
    leftBehindActive,
    trail: nextTrail,
    stepCount: nextStepCount,
    currentZone,
    distanceMeters: dist,
    nearestGateName: nearestGateMeters <= EXIT_GATE_THRESHOLD_METERS ? nearestGate.name : null,
    nearestGateMeters,
    activeAlerts: nextAlerts,
    lastAlertTimestamp,
    lastRecoveredAt,
    recoveredMessage,
    updatedAt: now,
  };
}

export function generateReturnPin(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function createNewBandSession(params: {
  bandId: string;
  childName: string;
  editionId: EditionId;
  safeRadius: number;
  mallName: string;
}): BandSession {
  const now = Date.now();
  const base: BandSession = {
    bandId: params.bandId,
    childName: params.childName.trim(),
    editionId: params.editionId,
    returnPin: generateReturnPin(),
    status: 'active',
    issuedAt: now,
    safeRadius: params.safeRadius,
    battery: 96,
    claspLocked: true,
    tamperActive: false,
    leftBehindActive: false,
    parentPos: { ...DEFAULT_PARENT_POS },
    childPos: { ...DEFAULT_CHILD_POS },
    trail: [{ ...DEFAULT_CHILD_POS }],
    stepCount: 0,
    currentZone: 'البوث الذكي - نقطة الأمان',
    distanceMeters: distanceMeters(DEFAULT_PARENT_POS, DEFAULT_CHILD_POS),
    nearestGateName: null,
    nearestGateMeters: 22,
    activeAlerts: [],
    lastAlertTimestamp: 0,
    lastRecoveredAt: 0,
    recoveredMessage: '',
    updatedAt: now,
    mallName: params.mallName,
  };
  return evaluateBandSession(base, {}, { appendTrail: false });
}

export function getZoneBadgeStatus(band: BandSession): 'safe' | 'warning' | 'critical' {
  if (band.activeAlerts.some((a) => a.severity === 'critical')) return 'critical';
  if (band.activeAlerts.length > 0) return 'warning';
  if (band.distanceMeters >= band.safeRadius * 0.82) return 'warning';
  return 'safe';
}
