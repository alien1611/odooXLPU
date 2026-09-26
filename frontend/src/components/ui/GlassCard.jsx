import React from 'react';

/**
 * Reusable frosted-glass card component with high contrast readability.
 * Used for: top navigation, KPI row, modals, floating filters, highlight panels.
 */
export default function GlassCard({
  children,
  className = '',
  hoverEffect = false,
  padding = 'p-5',
  ...props
}) {
  return (
    <div
      className={`bg-white/90 backdrop-blur-xl border border-slate-200/90 rounded-[20px] shadow-[0_4px_24px_rgba(0,0,0,0.04)] ${padding} ${
        hoverEffect ? 'transition-all duration-200 hover:shadow-[0_8px_32px_rgba(0,0,0,0.07)] hover:bg-white' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
