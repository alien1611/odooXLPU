import React from 'react';

/**
 * Minimalist Apple-style subtle pulse loading indicator.
 */
export default function LoadingState({ message = 'Loading...', className = '' }) {
  return (
    <div className={`py-12 flex flex-col items-center justify-center gap-3 text-neutral-400 ${className}`}>
      <div className="flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full bg-amber-600/70 animate-pulse" />
        <span className="w-2 h-2 rounded-full bg-amber-600/70 animate-pulse [animation-delay:150ms]" />
        <span className="w-2 h-2 rounded-full bg-amber-600/70 animate-pulse [animation-delay:300ms]" />
      </div>
      <p className="text-xs font-normal tracking-tight text-neutral-400">
        {message}
      </p>
    </div>
  );
}
