import React from 'react';

/**
 * Minimalist pill badge with subtle indicator dot.
 * Adheres to rule: Status colors used only for small badges and indicator dots.
 */
export default function Badge({
  children,
  variant = 'neutral', // 'neutral' | 'success' | 'warning' | 'danger' | 'accent' | 'info'
  dot = true,
  size = 'sm',
  className = ''
}) {
  const dotVariants = {
    neutral: 'bg-neutral-400',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500',
    accent: 'bg-amber-600',
    info: 'bg-blue-500'
  };

  const bgVariants = {
    neutral: 'bg-neutral-100 text-neutral-700 border-neutral-200/60',
    success: 'bg-emerald-50/80 text-emerald-800 border-emerald-200/60',
    warning: 'bg-amber-50/80 text-amber-800 border-amber-200/60',
    danger: 'bg-rose-50/80 text-rose-800 border-rose-200/60',
    accent: 'bg-amber-50/80 text-amber-900 border-amber-200/70',
    info: 'bg-blue-50/80 text-blue-800 border-blue-200/60'
  };

  const sizeClasses = size === 'xs' 
    ? 'text-[10px] px-2 py-0.5 gap-1' 
    : 'text-xs px-2.5 py-1 gap-1.5';

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${sizeClasses} ${
        bgVariants[variant] || bgVariants.neutral
      } ${className}`}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
            dotVariants[variant] || dotVariants.neutral
          }`}
        />
      )}
      <span>{children}</span>
    </span>
  );
}
