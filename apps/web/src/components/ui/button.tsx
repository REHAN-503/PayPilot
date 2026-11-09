import * as React from 'react';
import { cn } from '../../lib/utils';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'glow' | 'accent';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const base = 'pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius)] text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ledger)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer';
    const variants = {
      default: 'bg-[var(--ledger)] text-[var(--ledger-ink)] hover:brightness-110',
      destructive: 'bg-[var(--vermilion)] text-[var(--ink)] hover:brightness-110',
      outline: 'border border-[var(--rule)] bg-transparent text-[var(--ink)] hover:bg-[var(--paper-2)]',
      secondary: 'bg-[var(--paper-2)] text-[var(--ink)] hover:bg-[var(--rule)]',
      ghost: 'text-[var(--ink-2)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]',
      glow: 'bg-[var(--ledger)] text-[var(--ledger-ink)] hover:brightness-110',
      accent: 'bg-[var(--brass)] text-[var(--ink)] hover:brightness-110',
    };
    const sizes = {
      default: 'h-10 px-4 py-2',
      sm: 'h-8 px-3 text-xs',
      lg: 'h-12 px-6 text-base',
      icon: 'h-10 w-10',
    };
    return <button ref={ref} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
  },
);
Button.displayName = 'Button';
