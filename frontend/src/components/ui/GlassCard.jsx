import React from 'react';

/**
 * Reusable frosted-glass card component.
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
      className={`bg-white/65 backdrop-blur-xl border border-white/60 rounded-[20px] shadow-[0_8px_32px_rgba(0,0,0,0.04)] ${padding} ${
        hoverEffect ? 'transition-all duration-200 hover:shadow-[0_12px_40px_rgba(0,0,0,0.07)] hover:bg-white/75' : ''
      } ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
