import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'agent';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants = {
    default: 'bg-[var(--ledger)] text-[var(--ledger-ink)] border-[var(--ledger)]',
    secondary: 'bg-[var(--paper-2)] text-[var(--ink-2)] border-[var(--rule)]',
    destructive: 'bg-[var(--vermilion)] text-[var(--ink)] border-[var(--vermilion)]',
    outline: 'text-[var(--ink-2)] border-[var(--rule)]',
    success: 'bg-[var(--verdigris)] text-[var(--ink)] border-[var(--verdigris)]',
    warning: 'bg-[var(--amber)] text-[var(--ink)] border-[var(--amber)]',
    agent: 'bg-[var(--brass)] text-[var(--ink)] border-[var(--brass)]',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors focus:outline-none',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
