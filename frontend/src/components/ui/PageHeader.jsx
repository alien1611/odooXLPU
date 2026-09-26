import React from 'react';

/**
 * Standardized Apple-style page header with high-contrast typography.
 */
export default function PageHeader({
  title,
  description,
  subtitle,
  badge,
  actions,
  className = ''
}) {
  const desc = description || subtitle;

  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 ${className}`}>
      <div className="space-y-1">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-[-0.02em]">
            {title}
          </h1>
          {typeof badge === 'number' || typeof badge === 'string' ? (
            <span className="px-2.5 py-0.5 rounded-full bg-slate-200/80 border border-slate-300 text-xs font-mono font-semibold text-slate-800">
              {badge}
            </span>
          ) : (
            badge
          )}
        </div>
        {desc && (
          <p className="text-xs sm:text-sm text-slate-600 max-w-2xl leading-relaxed">
            {desc}
          </p>
        )}
      </div>

      {actions && (
        <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
          {actions}
        </div>
      )}
    </div>
  );
}
