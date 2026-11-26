import React, { useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { Download, Grid2X2, Printer, QrCode, Square } from 'lucide-react';
import { EDITION_LIST, WRISTBAND_EDITIONS } from '../data/mallConfig';
import { EditionId } from '../types/safestep';
import { buildParentScanUrl } from '../utils/storage';
import { EditionBadge } from './EditionBadge';
import { QrCodeCanvas } from './QrCodeCanvas';

interface QrStudioViewProps {
  mallName: string;
  publicBaseUrl: string;
  onUpdateMallName: (name: string) => void;
  onUpdatePublicBaseUrl: (url: string) => void;
  defaultBandId: string;
}

interface StickerSpec {
  bandId: string;
  editionId: EditionId;
  url: string;
}

export const QrStudioView: React.FC<QrStudioViewProps> = ({
  mallName,
  publicBaseUrl,
  onUpdateMallName,
  onUpdatePublicBaseUrl,
  defaultBandId,
}) => {
  const [mode, setMode] = useState<'single' | 'batch'>('batch');
  const [batchCount, setBatchCount] = useState<6 | 12 | 18>(6);
  const [startNumber, setStartNumber] = useState<number>(() => {
    const parsed = parseInt(defaultBandId.replace(/\D/g, ''), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 101;
  });
  const [editionMode, setEditionMode] = useState<'rotate' | EditionId>('rotate');
  const [downloading, setDownloading] = useState(false);

  const stickers: StickerSpec[] = useMemo(() => {
    const count = mode === 'single' ? 1 : batchCount;
    const list: StickerSpec[] = [];
    for (let i = 0; i < count; i++) {
      const bandId = `SKB-${startNumber + i}`;
      const editionId: EditionId =
        editionMode === 'rotate'
          ? EDITION_LIST[i % EDITION_LIST.length].id
          : editionMode;
      list.push({
        bandId,
        editionId,
        url: buildParentScanUrl(publicBaseUrl, bandId),
      });
    }
    return list;
  }, [mode, batchCount, startNumber, editionMode, publicBaseUrl]);

  /**
   * Renders a crisp high-resolution print-ready PNG (Single Sticker or full A4 Batch Sheet)
   * complete with corner crop marks, mall name, edition label, serial code, and QR.
   */
  const handleDownloadPng = async () => {
    setDownloading(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const drawCropMarks = (x: number, y: number, w: number, h: number, markLen: number) => {
        ctx.strokeStyle = '#94A3B8';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Top-left
        ctx.moveTo(x - markLen, y);
        ctx.lineTo(x + markLen * 0.4, y);
        ctx.moveTo(x, y - markLen);
        ctx.lineTo(x, y + markLen * 0.4);
        // Top-right
        ctx.moveTo(x + w + markLen, y);
        ctx.lineTo(x + w - markLen * 0.4, y);
        ctx.moveTo(x + w, y - markLen);
        ctx.lineTo(x + w, y + markLen * 0.4);
        // Bottom-left
        ctx.moveTo(x - markLen, y + h);
        ctx.lineTo(x + markLen * 0.4, y + h);
        ctx.moveTo(x, y + h + markLen);
        ctx.lineTo(x, y + h - markLen * 0.4);
        // Bottom-right
        ctx.moveTo(x + w + markLen, y + h);
        ctx.lineTo(x + w - markLen * 0.4, y + h);
        ctx.moveTo(x + w, y + h + markLen);
        ctx.lineTo(x + w, y + h - markLen * 0.4);
        ctx.stroke();
      };

      const drawStickerCard = async (
        spec: StickerSpec,
        x: number,
        y: number,
        w: number,
        h: number
      ) => {
        const ed = WRISTBAND_EDITIONS[spec.editionId];

        // White card background + subtle cut border
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y, w, h);
        ctx.strokeStyle = '#E2E8F0';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(x, y, w, h);

        // Top accent bar matching wristband color
        ctx.fillStyle = ed.strapColor;
        ctx.fillRect(x, y, w, 10);

        // Mall Name
        ctx.fillStyle = '#475569';
        ctx.font = `600 ${Math.round(w * 0.048)}px Alexandria, sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(mallName || 'SafeStep Booth', x + w / 2, y + h * 0.11);

        // Edition Name
        ctx.fillStyle = '#0F172A';
        ctx.font = `700 ${Math.round(w * 0.056)}px Alexandria, sans-serif`;
        ctx.fillText(ed.name, x + w / 2, y + h * 0.175);

        // High-res QR Code
        const qrSize = Math.round(Math.min(w * 0.62, h * 0.5));
        const qrDataUrl = await QRCode.toDataURL(spec.url, {
          errorCorrectionLevel: 'M',
          margin: 1,
          width: qrSize * 2,
          color: { dark: '#0F172A', light: '#FFFFFF' },
        });
        const img = new Image();
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject(new Error('QR render error'));
          img.src = qrDataUrl;
        });
        ctx.drawImage(img, x + (w - qrSize) / 2, y + h * 0.22, qrSize, qrSize);

        // Serial ID
        ctx.fillStyle = '#0F172A';
        ctx.font = `700 ${Math.round(w * 0.068)}px Alexandria, sans-serif`;
        ctx.fillText(spec.bandId, x + w / 2, y + h * 0.81);

        // Scan instruction
        ctx.fillStyle = '#475569';
        ctx.font = `500 ${Math.round(w * 0.044)}px Alexandria, sans-serif`;
        ctx.fillText('امسح الكود لمتابعة طفلك', x + w / 2, y + h * 0.905);

        drawCropMarks(x, y, w, h, 14);
      };

      if (mode === 'single') {
        canvas.width = 760;
        canvas.height = 960;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await drawStickerCard(stickers[0], 60, 60, 640, 840);
      } else {
        // High-res A4 Sheet (1654 x 2339 at ~200 DPI)
        canvas.width = 1654;
        canvas.height = 2339;
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        const cols = batchCount === 6 ? 2 : 3;
        const rows = Math.ceil(batchCount / cols);
        const margin = 80;
        const gap = 36;
        const cellW = (canvas.width - margin * 2 - gap * (cols - 1)) / cols;
        const cellH = (canvas.height - margin * 2 - gap * (rows - 1)) / rows;

        for (let i = 0; i < stickers.length; i++) {
          const r = Math.floor(i / cols);
          const c = i % cols;
          const x = margin + c * (cellW + gap);
          const y = margin + r * (cellH + gap);
          await drawStickerCard(stickers[i], x, y, cellW, cellH);
        }
      }

      const link = document.createElement('a');
      link.download =
        mode === 'single'
          ? `SafeStep-${stickers[0].bandId}.png`
          : `SafeStep-A4-Sheet-${batchCount}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setDownloading(false);
    }
  };

  const gridColsClass =
    mode === 'single'
      ? 'grid-cols-1 max-w-sm mx-auto'
      : batchCount === 6
        ? 'grid-cols-1 sm:grid-cols-2'
        : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className="space-y-6">
      {/* Studio Controls Panel (Hidden when printing A4) */}
      <section className="no-print glass-surface rounded-2xl p-6 space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900/8 text-slate-900 flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" strokeWidth={1.85} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900">استوديو طباعة ملصقات QR للأساور</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                توليد ملصقات عالية الدقة بعلامات قص هندسية جاهزة للطباعة الفورية على ورق A4
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleDownloadPng}
              disabled={downloading}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-900 flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Download className="w-4 h-4 text-slate-600" strokeWidth={1.85} />
              <span>{downloading ? 'جاري التجهيز' : 'تحميل صورة PNG جاهزة للطباعة'}</span>
            </button>

            <button
              type="button"
              onClick={() => window.print()}
              className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Printer className="w-4 h-4" strokeWidth={1.85} />
              <span>طباعة فورية A4</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-3 border-t border-slate-200/75">
          {/* Mode Switch */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">نمط الطباعة</label>
            <div className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-slate-100">
              <button
                type="button"
                onClick={() => setMode('single')}
                className={`py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  mode === 'single' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                <span>ملصق فردي</span>
              </button>
              <button
                type="button"
                onClick={() => setMode('batch')}
                className={`py-2 px-2.5 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors ${
                  mode === 'batch' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                }`}
              >
                <Grid2X2 className="w-3.5 h-3.5" />
                <span>ورقة A4</span>
              </button>
            </div>
          </div>

          {/* Batch Quantity or Serial Start */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              {mode === 'batch' ? 'عدد الأساور في ورقة A4' : 'رقم التسلسل المبدئي'}
            </label>
            {mode === 'batch' ? (
              <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-slate-100">
                {([6, 12, 18] as const).map((cnt) => (
                  <button
                    key={cnt}
                    type="button"
                    onClick={() => setBatchCount(cnt)}
                    className={`py-2 rounded-lg text-xs font-bold tabular-nums transition-colors ${
                      batchCount === cnt ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                    }`}
                  >
                    {cnt}
                  </button>
                ))}
              </div>
            ) : (
              <input
                type="number"
                min={100}
                max={9999}
                value={startNumber}
                onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value) || 101))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold tabular-nums text-slate-900 focus:outline-none focus:border-slate-900"
              />
            )}
          </div>

          {/* Edition Selector */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">تصميم السوار</label>
            <select
              value={editionMode}
              onChange={(e) => setEditionMode(e.target.value as 'rotate' | EditionId)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900"
            >
              <option value="rotate">توزيع تلقائي لجميع الإصدارات الأربعة</option>
              {EDITION_LIST.map((ed) => (
                <option key={ed.id} value={ed.id}>
                  {ed.name}
                </option>
              ))}
            </select>
          </div>

          {/* Starting Serial when in Batch mode */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">اسم المركز التجاري</label>
            <input
              type="text"
              value={mallName}
              onChange={(e) => onUpdateMallName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-medium text-slate-900 focus:outline-none focus:border-slate-900"
            />
          </div>
        </div>

        {/* Public URL + Starting Serial Row */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-9 space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700">
              رابط الموقع العام (يُشفّر داخل كل كود QR للمسح الفوري بالموبايل)
            </label>
            <input
              type="url"
              dir="ltr"
              value={publicBaseUrl}
              onChange={(e) => onUpdatePublicBaseUrl(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-mono text-slate-700 focus:outline-none focus:border-slate-900"
            />
          </div>

          {mode === 'batch' && (
            <div className="lg:col-span-3 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                بداية التسلسل (SKB-)
              </label>
              <input
                type="number"
                min={100}
                max={9999}
                value={startNumber}
                onChange={(e) => setStartNumber(Math.max(1, Number(e.target.value) || 101))}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 text-xs font-bold tabular-nums text-slate-900 focus:outline-none focus:border-slate-900"
              />
            </div>
          )}
        </div>
      </section>

      {/* Print-Ready A4 Preview Surface */}
      <section className="print-only-root bg-white rounded-2xl p-6 sm:p-8 border border-slate-200/90 shadow-[0_10px_35px_rgba(15,23,42,0.05)]">
        <div className="no-print flex items-center justify-between mb-6 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              معاينة ورقة الطباعة ({mode === 'single' ? 'ملصق واحد' : `${batchCount} ملصقاً على ورقة A4`})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              كل ملصق مزوّد بعلامات قص دقيقة في الزوايا الأربع ورمز QR بمستوى تصحيح أخطاء M
            </p>
          </div>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            SKB-{startNumber} — SKB-{startNumber + stickers.length - 1}
          </span>
        </div>

        <div className={`print-sheet-grid grid ${gridColsClass} gap-6`}>
          {stickers.map((spec) => {
            const ed = WRISTBAND_EDITIONS[spec.editionId];
            return (
              <div
                key={spec.bandId}
                className="print-sticker-card relative p-3 bg-white"
              >
                {/* Precision Corner Crop Marks (علامات قص هندسية) */}
                <span className="pointer-events-none absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-slate-400" />
                <span className="pointer-events-none absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-slate-400" />
                <span className="pointer-events-none absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-slate-400" />
                <span className="pointer-events-none absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-slate-400" />

                <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
                  {/* Top Edition Color Band */}
                  <div className="h-2 w-full" style={{ backgroundColor: ed.strapColor }} />

                  <div className="p-4 flex flex-col items-center text-center space-y-3">
                    <div className="w-full flex items-center justify-between gap-2 text-right">
                      <div className="min-w-0">
                        <div className="text-[11px] font-medium text-slate-500 truncate">
                          {mallName}
                        </div>
                        <div className="text-xs font-bold text-slate-900 truncate">{ed.name}</div>
                      </div>
                      <EditionBadge editionId={spec.editionId} size="sm" />
                    </div>

                    <div className="p-2 rounded-xl bg-white border border-slate-100">
                      <QrCodeCanvas value={spec.url} size={mode === 'single' ? 196 : 140} />
                    </div>

                    <div className="space-y-0.5">
                      <div className="text-sm font-bold text-slate-900 tabular-nums tracking-wide">
                        {spec.bandId}
                      </div>
                      <div className="text-[11px] font-medium text-slate-600">
                        امسح الكود لمتابعة طفلك
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
};
