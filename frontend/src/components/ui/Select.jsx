import React, { forwardRef } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * Apple-style pill-shaped select element with high contrast readability.
 */
const Select = forwardRef(({
  label,
  error,
  options = [],
  children,
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
        <select
          ref={ref}
          className={`block w-full text-xs text-slate-900 bg-white border border-slate-300 shadow-2xs focus:outline-none focus:bg-white focus:border-amber-600 focus:ring-2 focus:ring-amber-500/20 transition-all duration-150 appearance-none pl-4 pr-9 py-2.5 cursor-pointer font-medium ${
            pill ? 'rounded-full' : 'rounded-xl'
          } ${error ? 'border-rose-500 focus:border-rose-600' : ''} ${className}`}
          {...props}
        >
          {children || options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <div className="absolute right-3.5 text-slate-500 pointer-events-none flex items-center">
          <ChevronDown className="w-3.5 h-3.5 stroke-[2]" />
        </div>
      </div>
      {error && (
        <p className="text-[11px] font-medium text-rose-600 pl-1">{error}</p>
      )}
    </div>
  );
});

Select.displayName = 'Select';
export default Select;
