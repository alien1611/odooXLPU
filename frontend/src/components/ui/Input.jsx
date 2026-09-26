import React, { forwardRef } from 'react';

/**
 * Apple-style pill-shaped input field with high contrast readability.
 */
const Input = forwardRef(({
  label,
  error,
  icon: Icon,
  type = 'text',
  className = '',
  wrapperClassName = '',
  pill = true,
  ...props
}, ref) => {
  return (
    <div className={`space-y-1.5 ${wrapperClassName}`}>
      {label && (
        <label className="block text-xs font-semibold text-slate-800 pl-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-slate-500 pointer-events-none flex items-center">
            <Icon className="w-4 h-4 stroke-[1.8]" />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={`block w-full text-xs text-slate-900 bg-white border border-slate-300 shadow-2xs placeholder:text-slate-400 focus:outline-none focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 transition-all duration-150 ${
            pill ? 'rounded-full' : 'rounded-xl'
          } ${Icon ? 'pl-9 pr-4 py-2.5' : 'px-4 py-2.5'} ${
            error ? 'border-rose-500 focus:border-rose-600 focus:ring-rose-500/20' : ''
          } ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-[11px] font-medium text-rose-600 pl-1">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
