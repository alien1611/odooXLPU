import React from 'react';

/**
 * Apple-style clean data table container.
 * Solid white surface, 16px radius, subtle separators, spacious padding.
 */
export default function DataTable({
  headers = [],
  children,
  empty = false,
  emptyMessage = "No records found.",
  emptyIcon,
  className = "",
  overflowX = true
}) {
  return (
    <div className={`bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden ${className}`}>
      <div className={overflowX ? "overflow-x-auto" : ""}>
        <table className="w-full text-left text-xs border-collapse">
          {headers.length > 0 && (
            <thead>
              <tr className="border-b border-neutral-100 bg-neutral-50/60 text-neutral-500 font-medium">
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-3 font-medium tracking-tight whitespace-nowrap ${
                      h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left'
                    } ${h.className || ''}`}
                  >
                    {h.label || h}
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody className="divide-y divide-neutral-100/80">
            {children}
          </tbody>
        </table>
      </div>

      {empty && (
        <div className="py-12 text-center text-xs text-neutral-400">
          {emptyIcon && (
            <div className="mx-auto mb-2 text-neutral-300 flex justify-center">
              {emptyIcon}
            </div>
          )}
          <p>{emptyMessage}</p>
        </div>
      )}
    </div>
  );
}
