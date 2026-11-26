import React, { useMemo, useRef, useState } from 'react';
import {
  EXIT_GATE_THRESHOLD_METERS,
  MALL_GATES,
  MALL_HEIGHT,
  MALL_SECTORS,
  MALL_WIDTH,
  PIXELS_PER_METER,
  WRISTBAND_EDITIONS,
  clampToMall,
  distanceMeters,
  getZoneBadgeStatus,
} from '../data/mallConfig';
import { BandSession, Point } from '../types/safestep';
import { Compass, Hand, MapPin, ShieldAlert, ShieldCheck } from 'lucide-react';

interface SmartMallMapProps {
  band: BandSession;
  readOnly?: boolean;
  compact?: boolean;
  onMoveChild?: (pos: Point) => void;
  onMoveParent?: (pos: Point) => void;
}

/**
 * Generates a smooth SVG quadratic spline path through child footsteps coordinates.
 */
function buildSmoothPath(points: Point[]): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  if (points.length === 2) {
    return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
  }
  let d = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const midX = (points[i].x + points[i + 1].x) / 2;
    const midY = (points[i].y + points[i + 1].y) / 2;
    d += ` Q ${points[i].x} ${points[i].y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}

export const SmartMallMap: React.FC<SmartMallMapProps> = ({
  band,
  readOnly = false,
  compact = false,
  onMoveChild,
  onMoveParent,
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [dragging, setDragging] = useState<'child' | 'parent' | null>(null);

  const statusLevel = getZoneBadgeStatus(band);
  const edition = WRISTBAND_EDITIONS[band.editionId];

  const safeRadiusPx = band.safeRadius * PIXELS_PER_METER;
  const smoothTrail = useMemo(() => buildSmoothPath(band.trail), [band.trail]);

  // Step dots sampled cleanly along the child's actual path
  const trailNodes = useMemo(() => {
    if (band.trail.length <= 2) return [];
    const step = Math.max(1, Math.floor(band.trail.length / 18));
    const nodes: Point[] = [];
    for (let i = 0; i < band.trail.length - 1; i += step) {
      nodes.push(band.trail[i]);
    }
    return nodes;
  }, [band.trail]);

  const tetherColor =
    statusLevel === 'critical'
      ? '#DC2626'
      : statusLevel === 'warning'
        ? '#D97706'
        : '#0D9488';

  const tetherMidpoint: Point = {
    x: (band.parentPos.x + band.childPos.x) / 2,
    y: (band.parentPos.y + band.childPos.y) / 2,
  };

  // Keep floating midpoint label cleanly inside viewBox
  const clampedMidX = Math.max(115, Math.min(MALL_WIDTH - 115, tetherMidpoint.x));
  const clampedMidY = Math.max(66, Math.min(MALL_HEIGHT - 56, tetherMidpoint.y - 18));

  const tetherStatusLabel =
    statusLevel === 'critical'
      ? 'خطر فوري'
      : statusLevel === 'warning'
        ? 'تجاوز النطاق'
        : 'آمن';

  const clientToSvgPoint = (clientX: number, clientY: number): Point | null => {
    const svg = svgRef.current;
    if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return null;
    const scaleX = MALL_WIDTH / rect.width;
    const scaleY = MALL_HEIGHT / rect.height;
    return clampToMall({
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    });
  };

  const handlePointerDownPin = (target: 'child' | 'parent', e: React.PointerEvent) => {
    if (readOnly) return;
    e.stopPropagation();
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
    setDragging(target);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (readOnly || !dragging) return;
    const pt = clientToSvgPoint(e.clientX, e.clientY);
    if (!pt) return;
    if (dragging === 'child' && onMoveChild) {
      onMoveChild(pt);
    } else if (dragging === 'parent' && onMoveParent) {
      onMoveParent(pt);
    }
  };

  const handlePointerUp = () => {
    if (dragging) setDragging(null);
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-[#F8FAFC] border border-slate-200/85 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)] select-none">
      {/* Top Architectural Overlay Header */}
      <div
        className={`flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 bg-white/80 backdrop-blur-md ${
          compact ? 'px-3 py-2' : 'px-4 py-2.5'
        }`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
              statusLevel === 'critical'
                ? 'bg-red-50 text-red-600'
                : statusLevel === 'warning'
                  ? 'bg-amber-50 text-amber-600'
                  : 'bg-teal-50 text-teal-700'
            }`}
          >
            {statusLevel === 'safe' ? (
              <ShieldCheck className="w-4 h-4" strokeWidth={1.85} />
            ) : (
              <ShieldAlert className="w-4 h-4" strokeWidth={1.85} />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 truncate">
              <span className="text-slate-500 font-normal">الموقع الحالي:</span>
              <span className="truncate">{band.currentZone}</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1 tabular-nums">
            <Compass className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
            نطاق الأمان {band.safeRadius} م
          </span>
          {!readOnly && !compact && (
            <span className="hidden sm:flex items-center gap-1 text-slate-500">
              <Hand className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
              اسحب أيقونة الطفل أو ولي الأمر مباشرة
            </span>
          )}
        </div>
      </div>

      {/* Interactive 2.5D Architectural Floorplan SVG */}
      <div className="relative w-full aspect-[1000/620] touch-none">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${MALL_WIDTH} ${MALL_HEIGHT}`}
          className="w-full h-full block"
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          <defs>
            {/* Subtle architectural engineering blueprint grid */}
            <pattern id="archGrid" width="36" height="36" patternUnits="userSpaceOnUse">
              <path
                d="M 36 0 L 0 0 0 36"
                fill="none"
                stroke="#E2E8F0"
                strokeWidth="0.65"
                strokeOpacity="0.65"
              />
            </pattern>

            {/* 2.5D architectural soft elevation shadow */}
            <filter id="wingShadow" x="-8%" y="-8%" width="118%" height="122%">
              <feDropShadow dx="0" dy="6" stdDeviation="6" floodColor="#0F172A" floodOpacity="0.06" />
            </filter>

            <filter id="pinShadow" x="-30%" y="-30%" width="160%" height="160%">
              <feDropShadow dx="0" dy="4" stdDeviation="4" floodColor="#0F172A" floodOpacity="0.18" />
            </filter>

            <radialGradient id="safeRingFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#0D9488" stopOpacity="0.03" />
              <stop offset="75%" stopColor="#0D9488" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#0D9488" stopOpacity="0.17" />
            </radialGradient>

            <radialGradient id="breachRingFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#DC2626" stopOpacity="0.02" />
              <stop offset="80%" stopColor="#DC2626" stopOpacity="0.07" />
              <stop offset="100%" stopColor="#DC2626" stopOpacity="0.16" />
            </radialGradient>

            <linearGradient id="atriumFloor" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#F8FAFC" />
              <stop offset="100%" stopColor="#EEF2F7" />
            </linearGradient>

            <linearGradient id="trailGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0D9488" stopOpacity="0.3" />
              <stop offset="100%" stopColor={tetherColor} stopOpacity="0.92" />
            </linearGradient>
          </defs>

          {/* Outer Perimeter Architectural Slab */}
          <rect x="0" y="0" width={MALL_WIDTH} height={MALL_HEIGHT} fill="url(#atriumFloor)" />
          <rect x="0" y="0" width={MALL_WIDTH} height={MALL_HEIGHT} fill="url(#archGrid)" />

          {/* Mall Outer Structural Wall Shell (2.5D beveled outline) */}
          <rect
            x="38"
            y="38"
            width={MALL_WIDTH - 76}
            height={MALL_HEIGHT - 76}
            rx="24"
            fill="#FFFFFF"
            fillOpacity="0.58"
            stroke="#CBD5E1"
            strokeWidth="2.5"
          />

          {/* Central Spine Corridors (Horizontal + Vertical Promenade) */}
          <rect
            x="404"
            y="44"
            width="192"
            height={MALL_HEIGHT - 88}
            fill="#F8FAFC"
            fillOpacity="0.92"
          />
          <rect
            x="44"
            y="258"
            width={MALL_WIDTH - 88}
            height="104"
            fill="#F8FAFC"
            fillOpacity="0.92"
          />

          {/* Subtle Corridor Guide Lines */}
          <line
            x1="500"
            y1="56"
            x2="500"
            y2="564"
            stroke="#CBD5E1"
            strokeWidth="1"
            strokeDasharray="5 8"
          />
          <line
            x1="58"
            y1="310"
            x2="942"
            y2="310"
            stroke="#CBD5E1"
            strokeWidth="1"
            strokeDasharray="5 8"
          />

          {/* Central Promenade Label */}
          <text
            x="500"
            y="236"
            textAnchor="middle"
            fill="#94A3B8"
            fontSize="11"
            fontWeight="600"
            style={{ fontFamily: 'Alexandria, sans-serif' }}
          >
            الممر التجاري الرئيسي
          </text>

          {/* 4 Main Architectural Mall Sectors + Central Safety Booth */}
          {MALL_SECTORS.map((sector) => {
            const isActiveZone = band.currentZone === sector.name;
            const isBooth = sector.id === 'central_booth';

            return (
              <g key={sector.id} filter="url(#wingShadow)">
                {/* 2.5D Extruded Base Lip */}
                <rect
                  x={sector.x}
                  y={sector.y + 5}
                  width={sector.w}
                  height={sector.h}
                  rx={isBooth ? 18 : 16}
                  fill="#CBD5E1"
                  fillOpacity="0.55"
                />
                {/* Top Architectural Floor Surface */}
                <rect
                  x={sector.x}
                  y={sector.y}
                  width={sector.w}
                  height={sector.h}
                  rx={isBooth ? 18 : 16}
                  fill={isActiveZone ? sector.activeFill : sector.fill}
                  stroke={isActiveZone ? '#0D9488' : isBooth ? '#0F172A' : '#CBD5E1'}
                  strokeWidth={isActiveZone ? 2 : isBooth ? 1.6 : 1.1}
                  className="transition-colors duration-300"
                />

                {/* Architectural Interior Floorplan Micro-Details per Sector */}
                {sector.id === 'kids_arena' && (
                  <g opacity="0.45" stroke="#0D9488" strokeWidth="1" fill="none">
                    <circle cx={sector.x + 64} cy={sector.y + 128} r="28" strokeDasharray="3 4" />
                    <circle cx={sector.x + 258} cy={sector.y + 128} r="24" />
                    <rect x={sector.x + 122} y={sector.y + 106} width="84" height="44" rx="10" />
                  </g>
                )}
                {sector.id === 'food_court' && (
                  <g opacity="0.45" stroke="#B45309" strokeWidth="1" fill="none">
                    {[0, 1, 2, 3].map((idx) => (
                      <circle
                        key={idx}
                        cx={sector.x + 56 + idx * 70}
                        cy={sector.y + 132}
                        r="14"
                      />
                    ))}
                    <line
                      x1={sector.x + 26}
                      y1={sector.y + 84}
                      x2={sector.x + sector.w - 26}
                      y2={sector.y + 84}
                    />
                  </g>
                )}
                {(sector.id === 'family_retail_east' || sector.id === 'family_retail_west') && (
                  <g opacity="0.45" stroke="#64748B" strokeWidth="1" fill="none">
                    <rect x={sector.x + 24} y={sector.y + 92} width="86" height="76" rx="8" />
                    <rect x={sector.x + 120} y={sector.y + 92} width="86" height="76" rx="8" />
                    <rect x={sector.x + 216} y={sector.y + 92} width="86" height="76" rx="8" />
                  </g>
                )}

                {/* Sector Title */}
                <text
                  x={sector.x + sector.w / 2}
                  y={isBooth ? sector.y + 39 : sector.y + 38}
                  textAnchor="middle"
                  fill={isBooth ? '#0F172A' : '#1E293B'}
                  fontSize={isBooth ? '12.5' : '15'}
                  fontWeight="700"
                  style={{ fontFamily: 'Alexandria, sans-serif' }}
                >
                  {sector.name}
                </text>
                <text
                  x={sector.x + sector.w / 2}
                  y={isBooth ? sector.y + 58 : sector.y + 58}
                  textAnchor="middle"
                  fill={isBooth ? '#0D9488' : '#64748B'}
                  fontSize={isBooth ? '10.5' : '11.5'}
                  fontWeight="500"
                  style={{ fontFamily: 'Alexandria, sans-serif' }}
                >
                  {sector.enName}
                </text>
              </g>
            );
          })}

          {/* 4 Perimeter Mall Exit Gates with Geo-Fence Laser Threshold Lines */}
          {MALL_GATES.map((gate) => {
            const gateDist = distanceMeters(band.childPos, { x: gate.x, y: gate.y });
            const isGateAlert = gateDist <= EXIT_GATE_THRESHOLD_METERS;
            const isHorizontal = gate.orientation === 'horizontal';

            return (
              <g key={gate.id}>
                {/* Geo-fence 4m warning halo when triggered */}
                {isGateAlert && (
                  <circle
                    cx={gate.x}
                    cy={gate.y}
                    r={EXIT_GATE_THRESHOLD_METERS * PIXELS_PER_METER}
                    fill="#DC2626"
                    fillOpacity="0.14"
                    stroke="#DC2626"
                    strokeWidth="1.5"
                    strokeDasharray="5 5"
                  />
                )}

                {/* Geo-Fence Security Threshold Line */}
                <line
                  x1={gate.lineX1}
                  y1={gate.lineY1}
                  x2={gate.lineX2}
                  y2={gate.lineY2}
                  stroke={isGateAlert ? '#DC2626' : '#0D9488'}
                  strokeWidth={isGateAlert ? 5.5 : 3.5}
                  strokeLinecap="round"
                  className={isGateAlert ? 'animate-gate-laser' : ''}
                />

                {/* Gate Architectural Label */}
                <g
                  transform={`translate(${
                    gate.id === 'gate_2'
                      ? gate.x - 42
                      : gate.id === 'gate_4'
                        ? gate.x + 42
                        : gate.x
                  }, ${
                    gate.id === 'gate_1'
                      ? gate.y - 14
                      : gate.id === 'gate_3'
                        ? gate.y + 18
                        : gate.y
                  })`}
                >
                  <rect
                    x={isHorizontal ? -42 : -32}
                    y="-12"
                    width={isHorizontal ? 84 : 64}
                    height="24"
                    rx="7"
                    fill={isGateAlert ? '#DC2626' : '#0F172A'}
                    fillOpacity={isGateAlert ? 0.96 : 0.88}
                  />
                  <text
                    x="0"
                    y="4"
                    textAnchor="middle"
                    fill="#FFFFFF"
                    fontSize="11.5"
                    fontWeight="600"
                    style={{ fontFamily: 'Alexandria, sans-serif' }}
                  >
                    {gate.name}
                  </text>
                </g>
              </g>
            );
          })}

          {/* SIGNATURE ELEMENT 1: Dynamic Safe Radius Ring centered on Parent Beacon */}
          <g>
            <circle
              cx={band.parentPos.x}
              cy={band.parentPos.y}
              r={safeRadiusPx}
              fill={statusLevel === 'safe' ? 'url(#safeRingFill)' : 'url(#breachRingFill)'}
              stroke={statusLevel === 'safe' ? '#0D9488' : tetherColor}
              strokeWidth="2"
              strokeDasharray="7 6"
              className="transition-all duration-200"
            />
          </g>

          {/* SIGNATURE ELEMENT 3: Child Footsteps Trail (Glowing Curved Path + Step Nodes) */}
          {band.trail.length > 1 && (
            <g>
              {/* Soft outer glow */}
              <path
                d={smoothTrail}
                fill="none"
                stroke={tetherColor}
                strokeWidth="7"
                strokeOpacity="0.14"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Main footsteps curve */}
              <path
                d={smoothTrail}
                fill="none"
                stroke="url(#trailGradient)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Subtle step nodes along exact walked route */}
              {trailNodes.map((pt, index) => (
                <circle
                  key={`${pt.x}-${pt.y}-${index}`}
                  cx={pt.x}
                  cy={pt.y}
                  r="3.2"
                  fill="#FFFFFF"
                  stroke={tetherColor}
                  strokeWidth="1.8"
                  opacity="0.88"
                />
              ))}
            </g>
          )}

          {/* SIGNATURE ELEMENT 2: Live Parent-Child Tether with Floating Glass Distance Readout */}
          <g>
            {/* Under-glow */}
            <line
              x1={band.parentPos.x}
              y1={band.parentPos.y}
              x2={band.childPos.x}
              y2={band.childPos.y}
              stroke={tetherColor}
              strokeWidth="6"
              strokeOpacity="0.16"
              strokeLinecap="round"
            />
            {/* Animated directional tether */}
            <line
              x1={band.parentPos.x}
              y1={band.parentPos.y}
              x2={band.childPos.x}
              y2={band.childPos.y}
              stroke={tetherColor}
              strokeWidth="2.8"
              strokeDasharray="7 5"
              strokeLinecap="round"
              className="animate-tether-flow"
            />

            {/* Floating Frosted Glass Midpoint Distance Capsule */}
            <g transform={`translate(${clampedMidX}, ${clampedMidY})`} filter="url(#pinShadow)">
              <rect
                x="-82"
                y="-15"
                width="164"
                height="30"
                rx="15"
                fill="rgba(255,255,255,0.94)"
                stroke={tetherColor}
                strokeWidth="1.5"
              />
              <text
                x="0"
                y="4.5"
                textAnchor="middle"
                fill={tetherColor}
                fontSize="12"
                fontWeight="700"
                style={{ fontFamily: 'Alexandria, sans-serif' }}
              >
                {`${band.distanceMeters.toFixed(1)} متر · ${tetherStatusLabel}`}
              </text>
            </g>
          </g>

          {/* PARENT BEACON (Draggable in Booth Mode) */}
          <g
            transform={`translate(${band.parentPos.x}, ${band.parentPos.y})`}
            onPointerDown={(e) => handlePointerDownPin('parent', e)}
            style={{ cursor: readOnly ? 'default' : dragging === 'parent' ? 'grabbing' : 'grab' }}
          >
            {/* Interactive larger hit target */}
            <circle r="28" fill="transparent" />
            <circle r="21" fill="#0F172A" fillOpacity="0.09" />
            <circle
              r="15"
              fill="#0F172A"
              stroke="#FFFFFF"
              strokeWidth="3"
              filter="url(#pinShadow)"
            />
            {/* Parent Beacon geometric glyph */}
            <circle cx="0" cy="-3.2" r="3" fill="#FFFFFF" />
            <path d="M -5.5 5.5 C -5.5 1.8, 5.5 1.8, 5.5 5.5" fill="#FFFFFF" />
            {/* Label underneath */}
            <g transform="translate(0, 29)">
              <rect x="-34" y="-10" width="68" height="20" rx="6" fill="#0F172A" fillOpacity="0.88" />
              <text
                x="0"
                y="3.5"
                textAnchor="middle"
                fill="#FFFFFF"
                fontSize="10.5"
                fontWeight="600"
                style={{ fontFamily: 'Alexandria, sans-serif' }}
              >
                ولي الأمر
              </text>
            </g>
          </g>

          {/* CHILD WRISTBAND PIN (Draggable in Booth Mode) */}
          <g
            transform={`translate(${band.childPos.x}, ${band.childPos.y})`}
            onPointerDown={(e) => handlePointerDownPin('child', e)}
            style={{ cursor: readOnly ? 'default' : dragging === 'child' ? 'grabbing' : 'grab' }}
          >
            {/* Interactive larger hit target */}
            <circle r="30" fill="transparent" />
            {/* Radar pulse ring ONLY when alert is active */}
            {statusLevel !== 'safe' && (
              <circle
                r="22"
                fill="none"
                stroke={tetherColor}
                strokeWidth="2.5"
                className="animate-radar-wave"
              />
            )}
            <circle r="22" fill={tetherColor} fillOpacity="0.16" />
            <circle
              r="16"
              fill={statusLevel === 'safe' ? edition.strapColor : tetherColor}
              stroke="#FFFFFF"
              strokeWidth="3.2"
              filter="url(#pinShadow)"
            />
            {/* Child Initial / Wristband Center Dot */}
            <text
              x="0"
              y="4.5"
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="12"
              fontWeight="700"
              style={{ fontFamily: 'Alexandria, sans-serif' }}
            >
              {band.childName.trim().charAt(0) || 'ط'}
            </text>
            {/* Child Name Tag */}
            <g transform="translate(0, -29)">
              <rect
                x="-46"
                y="-11"
                width="92"
                height="22"
                rx="7"
                fill="#FFFFFF"
                fillOpacity="0.95"
                stroke={tetherColor}
                strokeWidth="1.4"
              />
              <text
                x="0"
                y="3.5"
                textAnchor="middle"
                fill="#0F172A"
                fontSize="11"
                fontWeight="700"
                style={{ fontFamily: 'Alexandria, sans-serif' }}
              >
                {band.childName}
              </text>
            </g>
          </g>
        </svg>
      </div>

      {/* Bottom Clean Map Legend Strip */}
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2 border-t border-slate-200/70 bg-white/75 text-[11px] text-slate-600">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0F172A]" />
              ولي الأمر
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488]" />
              نطاق الأمان والمسار
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0.5 bg-[#DC2626] rounded-full" />
              خط إنذار بوابات الخروج
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-slate-500 tabular-nums">
            <MapPin className="w-3.5 h-3.5 text-slate-400" strokeWidth={1.75} />
            <span>أقرب بوابة: {band.nearestGateMeters.toFixed(1)} متر</span>
          </div>
        </div>
      )}
    </div>
  );
};
