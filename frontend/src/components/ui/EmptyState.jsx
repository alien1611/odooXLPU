import React from 'react';
import Button from './Button';

/**
 * Minimalist Apple-style empty state.
 */
export default function EmptyState({
  icon: Icon,
  title = 'No items yet',
  description = 'There are no active records in this section.',
  actionLabel,
  onAction,
  className = ''
}) {
  return (
    <div className={`py-12 px-6 flex flex-col items-center justify-center text-center max-w-sm mx-auto ${className}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 mb-3.5 shadow-2xs">
          <Icon className="w-6 h-6 stroke-[1.5]" />
        </div>
      )}
      <h3 className="text-sm font-semibold text-neutral-800 tracking-[-0.01em]">
        {title}
      </h3>
      <p className="text-xs text-neutral-400 mt-1 leading-relaxed max-w-xs">
        {description}
      </p>
      {actionLabel && onAction && (
        <div className="mt-4">
          <Button variant="secondary" size="sm" onClick={onAction}>
            {actionLabel}
          </Button>
        </div>
      )}
    </div>
  );
}
