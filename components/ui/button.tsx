'use client';
import * as React from 'react';
export const Button = React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(
  ({ className='', ...props }, ref) => (
    <button ref={ref} className={`inline-flex items-center justify-center rounded-xl px-4 py-2 border bg-black text-white hover:opacity-90 disabled:opacity-50 ${className}`} {...props} />
  )
);
Button.displayName = 'Button';
