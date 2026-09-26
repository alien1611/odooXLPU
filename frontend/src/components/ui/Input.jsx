import React, { forwardRef } from 'react';

/**
 * Apple-style pill-shaped input field.
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
        <label className="block text-xs font-medium text-neutral-600 pl-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        {Icon && (
          <div className="absolute left-3.5 text-neutral-400 pointer-events-none flex items-center">
            <Icon className="w-4 h-4 stroke-[1.8]" />
          </div>
        )}
        <input
          ref={ref}
          type={type}
          className={`block w-full text-xs text-neutral-900 bg-white/90 border border-neutral-200/90 shadow-2xs placeholder:text-neutral-400 focus:outline-none focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 transition-all duration-150 ${
            pill ? 'rounded-full' : 'rounded-xl'
          } ${Icon ? 'pl-9 pr-4 py-2' : 'px-4 py-2'} ${
            error ? 'border-rose-400 focus:border-rose-500 focus:ring-rose-500/20' : ''
          } ${className}`}
          {...props}
        />
      </div>
      {error && (
        <p className="text-[11px] text-rose-600 pl-1">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;
