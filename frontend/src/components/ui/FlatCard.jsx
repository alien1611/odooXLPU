import React from 'react';

/**
 * Standard content card.
 * Solid surface, 16px radius, subtle border, minimal shadow.
 */
export default function FlatCard({
  children,
  className = '',
  padding = 'p-5',
  ...props
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-black/[0.06] shadow-[0_1px_3px_rgba(0,0,0,0.02)] ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
