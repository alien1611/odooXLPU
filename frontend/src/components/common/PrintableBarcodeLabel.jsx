import React from 'react';
import { Printer, X, Tag, MapPin, ShieldAlert } from 'lucide-react';
import { Button, Badge } from '../ui';

// Standard Code 128 Pattern Table (indices 0 to 106)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

/**
 * Pure SVG Code 128 (Subset B) Generator
 */
export function BarcodeSvg({ value = '', height = 50, moduleWidth = 2, showText = true, className = '' }) {
  if (!value) return null;

  const strVal = String(value).trim();
  const indices = [104]; // Start B
  let sum = 104;

  for (let i = 0; i < strVal.length; i++) {
    const code = strVal.charCodeAt(i) - 32;
    if (code >= 0 && code <= 95) {
      indices.push(code);
      sum += (i + 1) * code;
    }
  }

  indices.push(sum % 103);
  indices.push(106); // Stop symbol

  const elements = [];
  let totalModules = 0;

  indices.forEach((idx) => {
    const pattern = CODE128_PATTERNS[idx] || '212222';
    for (let j = 0; j < pattern.length; j++) {
      const width = parseInt(pattern[j], 10);
      const isBar = j % 2 === 0;
      elements.push({ width, isBar, x: totalModules });
      totalModules += width;
    }
  });

  const svgWidth = (totalModules + 20) * moduleWidth; // 10 module quiet zone on each side

  return (
    <div className={`flex flex-col items-center select-none ${className}`}>
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${svgWidth} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full max-w-[280px]"
      >
        <rect width={svgWidth} height={height} fill="#ffffff" />
        <g transform={`translate(${10 * moduleWidth}, 0)`}>
          {elements.map((el, i) =>
            el.isBar ? (
              <rect
                key={i}
                x={el.x * moduleWidth}
                y={0}
                width={el.width * moduleWidth}
                height={height}
                fill="#0f172a"
              />
            ) : null
          )}
        </g>
      </svg>
      {showText && (
        <span className="font-mono text-xs tracking-wider text-slate-800 font-semibold mt-1">
          {strVal}
        </span>
      )}
    </div>
  );
}

/**
 * Printable Standard Warehouse Label Component
 */
export function PrintableBarcodeLabel({
  entityType = 'product',
  barcode,
  title,
  subtitle,
  details = []
}) {
  const getBadge = () => {
    switch (entityType) {
      case 'product':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-medium uppercase tracking-wider">
            <Tag className="w-3 h-3 text-amber-600" /> Item
          </span>
        );
      case 'location':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-medium uppercase tracking-wider">
            <MapPin className="w-3 h-3 text-amber-600" /> Bin
          </span>
        );
      case 'lot':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-mono text-[10px] font-medium uppercase tracking-wider">
            <ShieldAlert className="w-3 h-3 text-amber-600" /> Lot
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="printable-label w-full max-w-sm bg-white border border-slate-300 rounded-2xl p-5 shadow-sm flex flex-col justify-between text-slate-900">
      {/* Header with facility & badge */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <span className="font-mono text-[11px] font-semibold tracking-widest text-slate-400 uppercase">
          STOCKYARD WMS
        </span>
        {getBadge()}
      </div>

      {/* Main entity info */}
      <div className="py-3">
        <h3 className="font-semibold text-sm text-slate-900 leading-tight truncate" title={title}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-slate-500 font-medium font-mono mt-1 truncate">
            {subtitle}
          </p>
        )}
      </div>

      {/* Barcode graphic */}
      <div className="py-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center my-2 px-3">
        <BarcodeSvg value={barcode || title} height={46} moduleWidth={1.8} />
      </div>

      {/* Key-Value Details */}
      {details.length > 0 && (
        <div className="pt-3 border-t border-slate-100 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px]">
          {details.map((d, idx) => (
            <div key={idx} className="truncate">
              <span className="text-slate-400 font-medium uppercase text-[9px] block">
                {d.label}
              </span>
              <span className="font-mono font-medium text-slate-800 truncate block">
                {d.value || '—'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Barcode Label Modal with Instant Print & Download Capabilities
 */
export default function BarcodeLabelModal({
  isOpen,
  onClose,
  entityType = 'product',
  barcode,
  title,
  subtitle,
  details = []
}) {
  if (!isOpen) return null;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-md flex items-center justify-center p-4">
      {/* Print-specific style block */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #printable-label-container, #printable-label-container * {
            visibility: visible !important;
          }
          #printable-label-container {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: flex !important;
            justify-content: center !important;
            align-items: center !important;
            background: #fff !important;
            padding: 20px !important;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="bg-white dark:bg-slate-900 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 flex items-center justify-between no-print">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
              <Printer className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Printable Warehouse Label</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Label Preview */}
        <div className="p-8 flex flex-col items-center justify-center bg-slate-50/50 dark:bg-slate-950/40">
          <div id="printable-label-container" className="w-full flex justify-center">
            <PrintableBarcodeLabel
              entityType={entityType}
              barcode={barcode}
              title={title}
              subtitle={subtitle}
              details={details}
            />
          </div>
          <p className="text-[11px] text-slate-400 mt-4 text-center no-print">
            Optimized for thermal label printers (3"x2" and 4"x2") and standard laser sheets.
          </p>
        </div>

        {/* Modal Footer / Actions */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-end gap-2.5 no-print">
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
          >
            Close
          </Button>
          <Button
            type="button"
            variant="primary"
            icon={Printer}
            onClick={handlePrint}
          >
            Print Barcode Label
          </Button>
        </div>
      </div>
    </div>
  );
}
