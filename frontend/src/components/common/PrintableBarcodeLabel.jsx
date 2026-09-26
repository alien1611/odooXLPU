import React from 'react';
import { Printer, X, Tag, MapPin, ShieldAlert } from 'lucide-react';

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
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-mono text-[10px] font-bold uppercase tracking-wider">
            <Tag className="w-3 h-3" /> Product / Item
          </span>
        );
      case 'location':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-mono text-[10px] font-bold uppercase tracking-wider">
            <MapPin className="w-3 h-3" /> Bin Location
          </span>
        );
      case 'lot':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-mono text-[10px] font-bold uppercase tracking-wider">
            <ShieldAlert className="w-3 h-3" /> Lot Batch / FEFO
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="printable-label w-full max-w-sm bg-white border-2 border-slate-900 rounded p-4 shadow-sm flex flex-col justify-between text-slate-900">
      {/* Header with facility & badge */}
      <div className="flex items-center justify-between pb-2 border-b border-slate-200">
        <span className="font-mono text-[11px] font-bold tracking-widest text-slate-600 uppercase">
          STOCKYARD WMS
        </span>
        {getBadge()}
      </div>

      {/* Main entity info */}
      <div className="py-2.5">
        <h3 className="font-bold text-sm text-slate-950 leading-tight truncate" title={title}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs text-slate-600 font-medium font-mono mt-0.5 truncate">
            {subtitle}
          </p>
        )}
      </div>

      {/* Barcode graphic */}
      <div className="py-2 bg-slate-50 border border-dashed border-slate-200 rounded flex flex-col items-center justify-center my-1 px-2">
        <BarcodeSvg value={barcode || title} height={46} moduleWidth={1.8} />
      </div>

      {/* Key-Value Details */}
      {details.length > 0 && (
        <div className="pt-2 border-t border-slate-200 grid grid-cols-2 gap-x-2 gap-y-1 text-[11px]">
          {details.map((d, idx) => (
            <div key={idx} className="truncate">
              <span className="text-slate-500 font-medium uppercase text-[9px] block">
                {d.label}
              </span>
              <span className="font-mono font-semibold text-slate-900 truncate block">
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
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
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

      <div className="bg-white rounded-lg border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-100">
        {/* Modal Header */}
        <div className="px-5 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between no-print">
          <div className="flex items-center gap-2">
            <Printer className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-slate-900">Printable Warehouse Label</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1 rounded"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body / Label Preview */}
        <div className="p-6 flex flex-col items-center justify-center bg-slate-100/60">
          <div id="printable-label-container" className="w-full flex justify-center">
            <PrintableBarcodeLabel
              entityType={entityType}
              barcode={barcode}
              title={title}
              subtitle={subtitle}
              details={details}
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-4 text-center no-print">
            Optimized for thermal label printers (3"x2" and 4"x2") and standard laser sheets.
          </p>
        </div>

        {/* Modal Footer / Actions */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 no-print">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 border border-slate-300 rounded text-xs font-medium text-slate-700 hover:bg-slate-100 transition-colors"
          >
            Close
          </button>
          <button
            type="button"
            onClick={handlePrint}
            className="px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium flex items-center gap-1.5 shadow-sm transition-colors"
          >
            <Printer className="w-3.5 h-3.5" />
            Print Barcode Label
          </button>
        </div>
      </div>
    </div>
  );
}
