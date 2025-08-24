'use client';
import * as React from 'react';
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className='', ...props }, ref) => (
    <input ref={ref} className={`w-full rounded-xl border px-3 py-2 outline-none focus:ring-2 focus:ring-neutral-300 ${className}`} {...props} />
  )
);
Input.displayName = 'Input';
