import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import Button from './Button';

/**
 * Apple-style frosted glass modal dialog.
 */
export default function Modal({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  maxWidth = 'max-w-lg',
  className = '',
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Frosted Backdrop */}
      <div 
        className="fixed inset-0 bg-neutral-900/30 backdrop-blur-md transition-opacity duration-200"
        onClick={onClose}
      />

      {/* Glass Modal Box */}
      <div 
        className={`relative w-full ${maxWidth} bg-white/90 backdrop-blur-2xl border border-white/60 shadow-[0_20px_50px_rgba(0,0,0,0.15)] rounded-[24px] p-6 sm:p-7 overflow-hidden transition-all duration-200 scale-100 ${className}`}
      >
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-neutral-100">
          <div>
            <h3 className="text-base font-semibold text-neutral-900 tracking-[-0.02em]">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-neutral-500 mt-0.5">{subtitle}</p>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="p-1 rounded-full text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="py-4">
          {children}
        </div>
      </div>
    </div>
  );
}
