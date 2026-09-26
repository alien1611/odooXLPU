import React from 'react';
import { RefreshCw } from 'lucide-react';

/**
 * Apple-style clean data table container.
 * Supports both declarative (columns + data) and slotted (headers + children) usage.
 */
export default function DataTable({
  headers = [],
  children,
  columns = [],
  data = [],
  loading = false,
  emptyState = null,
  empty = false,
  emptyMessage = "No records found.",
  emptyIcon,
  keyExtractor = (item, idx) => item.id || idx,
  className = "",
  overflowX = true
}) {
  const isDeclarative = columns.length > 0;
  const resolvedHeaders = isDeclarative 
    ? columns.map(c => ({
        label: c.header || c.label || '',
        align: c.className?.includes('text-right') ? 'right' : c.className?.includes('text-center') ? 'center' : 'left',
        className: c.className || ''
      }))
    : headers;

  const hasNoData = isDeclarative ? (!loading && (!data || data.length === 0)) : empty;

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden ${className}`}>
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-600">
          <RefreshCw className="w-5 h-5 text-amber-600 animate-spin mx-auto mb-3" />
          <span>Loading catalog data...</span>
        </div>
      ) : hasNoData ? (
        emptyState ? (
          emptyState
        ) : (
          <div className="py-16 text-center text-xs text-slate-500">
            {emptyIcon && (
              <div className="mx-auto mb-3 text-slate-400 flex justify-center">
                {emptyIcon}
              </div>
            )}
            <p className="font-medium text-slate-700">{emptyMessage}</p>
          </div>
        )
      ) : (
        <div className={overflowX ? "overflow-x-auto" : ""}>
          <table className="w-full text-left text-xs border-collapse">
            {resolvedHeaders.length > 0 && (
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-semibold text-[11px] uppercase tracking-wider">
                  {resolvedHeaders.map((h, i) => (
                    <th
                      key={i}
                      className={`px-5 py-3.5 whitespace-nowrap ${
                        h.align === 'right' ? 'text-right' : h.align === 'center' ? 'text-center' : 'text-left'
                      } ${h.className || ''}`}
                    >
                      {h.label || h}
                    </th>
                  ))}
                </tr>
              </thead>
            )}
            <tbody className="divide-y divide-slate-100">
              {isDeclarative ? (
                data.map((row, rowIdx) => (
                  <tr 
                    key={keyExtractor(row, rowIdx)}
                    className="hover:bg-slate-50/70 transition-colors"
                  >
                    {columns.map((col, colIdx) => {
                      const value = typeof col.accessor === 'function' 
                        ? col.accessor(row) 
                        : col.accessor 
                          ? row[col.accessor] 
                          : null;
                      return (
                        <td
                          key={colIdx}
                          className={`px-5 py-3.5 text-slate-900 ${col.className || ''}`}
                        >
                          {value}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                children
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
