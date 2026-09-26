import React from 'react';

/**
 * Apple-style pill button component.
 * Radius: 999px (pill-shaped).
 * Press feedback: scale(0.97).
 */
export default function Button({
  children,
  variant = 'primary', // 'primary' | 'secondary' | 'ghost' | 'danger' | 'icon'
  size = 'md', // 'sm' | 'md' | 'lg'
  icon: Icon,
  iconPosition = 'left',
  className = '',
  disabled = false,
  loading = false,
  type = 'button',
  onClick,
  ...props
}) {
  const baseStyles = 'inline-flex items-center justify-center select-none font-medium transition-all duration-150 ease-out active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none disabled:active:scale-100';

  const sizeStyles = {
    sm: 'text-xs px-3.5 py-1.5 gap-1.5 rounded-full',
    md: 'text-xs px-4 py-2 gap-2 rounded-full font-medium',
    lg: 'text-sm px-5 py-2.5 gap-2.5 rounded-full font-medium',
    iconSm: 'p-1.5 w-7 h-7 rounded-full',
    iconMd: 'p-2 w-8 h-8 rounded-full',
    iconLg: 'p-2.5 w-10 h-10 rounded-full'
  };

  const variants = {
    primary: 'bg-amber-600 hover:bg-amber-700 text-white shadow-sm hover:shadow',
    secondary: 'bg-white/80 hover:bg-white text-neutral-800 border border-neutral-200/80 shadow-2xs backdrop-blur-sm',
    ghost: 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/70',
    danger: 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80',
    icon: 'bg-white/80 hover:bg-white text-neutral-700 border border-neutral-200/70 shadow-2xs'
  };

  const currentSize = variant === 'icon' 
    ? (size === 'sm' ? sizeStyles.iconSm : size === 'lg' ? sizeStyles.iconLg : sizeStyles.iconMd)
    : sizeStyles[size];

  return (
    <button
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={`${baseStyles} ${currentSize} ${variants[variant] || variants.primary} ${className}`}
      {...props}
    >
      {loading ? (
        <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin shrink-0" />
      ) : (
        Icon && iconPosition === 'left' && <Icon className="w-3.5 h-3.5 shrink-0 stroke-[1.8]" />
      )}
      {children}
      {!loading && Icon && iconPosition === 'right' && (
        <Icon className="w-3.5 h-3.5 shrink-0 stroke-[1.8]" />
      )}
    </button>
  );
}
