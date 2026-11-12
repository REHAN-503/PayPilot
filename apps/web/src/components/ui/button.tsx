'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'glow' | 'accent';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', style, ...props }, ref) => {
    const base = 'pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ledger)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer';
    const variants: Record<string, string> = {
      default: 'bg-[var(--ledger)] text-[var(--ledger-ink)] hover:brightness-110',
      destructive: 'bg-[var(--vermilion)] text-white hover:brightness-110',
      outline: 'border border-[var(--rule)] bg-transparent text-[var(--ink)] hover:bg-[var(--paper-2)]',
      secondary: 'bg-[var(--paper-2)] text-[var(--ink)] hover:bg-[var(--rule)]',
      ghost: 'text-[var(--ink-2)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]',
      glow: 'bg-[var(--ledger)] text-[var(--ledger-ink)] hover:brightness-110 shadow-[0_0_0_1px_var(--ledger-glow),0_4px_16px_var(--ledger-glow)]',
      accent: 'bg-[var(--brass)] text-white hover:brightness-110',
    };
    const sizes: Record<string, string> = {
      default: 'h-10 px-4 py-2',
      sm: 'h-8 px-3 text-xs rounded-[10px]',
      lg: 'h-12 px-6 text-base rounded-[12px]',
      icon: 'h-10 w-10',
    };
    return (
      <button
        ref={ref}
        style={style}
        className={cn(base, variants[variant], sizes[size], className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
