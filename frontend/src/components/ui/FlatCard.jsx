import React from 'react';

/**
 * Standard content card with clean, high-contrast borders and Apple styling.
 * Solid surface, 16px radius, clear border, minimal shadow.
 */
export default function FlatCard({
  children,
  className = '',
  padding = 'p-5',
  ...props
}) {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200 shadow-xs ${padding} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
