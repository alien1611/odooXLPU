import React from 'react';

/**
 * Geometric Stockyard Brand Mark.
 * Minimalist stacked ledger & precision crate motif.
 * Works at favicon size, sidebar size, and large hero size.
 */
export default function Logo({ size = 'md', showWordmark = true, className = '', monochrome = false }) {
  const sizeMap = {
    sm: { icon: 'w-6 h-6', mark: 24, text: 'text-sm' },
    md: { icon: 'w-8 h-8', mark: 32, text: 'text-base' },
    lg: { icon: 'w-10 h-10', mark: 40, text: 'text-lg' },
    xl: { icon: 'w-12 h-12', mark: 48, text: 'text-xl' }
  };

  const { icon, mark, text } = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center gap-2.5 select-none ${className}`}>
      {/* Precision Geometric Mark */}
      <div 
        className={`${icon} rounded-xl flex items-center justify-center transition-transform hover:scale-105 ${
          monochrome 
            ? 'bg-neutral-900 text-white' 
            : 'bg-neutral-900 text-white shadow-sm'
        }`}
      >
        <svg 
          width={mark * 0.58} 
          height={mark * 0.58} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.8" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          {/* Abstract geometric ledger/stacked crate lines */}
          <rect x="3" y="3" width="18" height="6" rx="1.5" />
          <rect x="3" y="12" width="18" height="6" rx="1.5" />
          <path d="M7 6h2" strokeWidth="2" stroke="currentColor" />
          <path d="M7 15h2" strokeWidth="2" stroke="currentColor" />
          <circle cx="17" cy="6" r="0.8" fill="currentColor" />
          <circle cx="17" cy="15" r="0.8" fill="currentColor" />
          <path d="M12 9v3" strokeWidth="1.5" strokeOpacity="0.6" />
        </svg>
      </div>

      {showWordmark && (
        <div className="flex flex-col">
          <span className={`font-semibold tracking-[-0.02em] text-neutral-900 leading-none ${text}`}>
            Stockyard
          </span>
          <span className="text-[10px] tracking-wide text-neutral-400 font-normal uppercase mt-0.5">
            Logistics Core
          </span>
        </div>
      )}
    </div>
  );
}
