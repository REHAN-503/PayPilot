'use client';

import * as React from 'react';
import { cn } from '../../lib/utils';

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' | 'warning' | 'agent';
}

export function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  const variants: Record<string, string> = {
    default:     'bg-[var(--ledger)] text-[var(--ledger-ink)] border-[var(--ledger)]',
    secondary:   'bg-[var(--paper-2)] text-[var(--ink-2)] border-[var(--rule)]',
    destructive: 'bg-[var(--vermilion)]/15 text-[var(--vermilion)] border-[var(--vermilion)]/40',
    outline:     'text-[var(--ink-2)] border-[var(--rule)] bg-transparent',
    success:     'bg-[var(--verdigris)]/12 text-[var(--verdigris)] border-[var(--verdigris)]/40',
    warning:     'bg-[var(--amber)]/12 text-[var(--amber)] border-[var(--amber)]/40',
    agent:       'bg-[var(--purple)]/12 text-[var(--purple)] border-[var(--purple)]/40',
  };

  return (
    <div
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold transition-colors focus:outline-none gap-1',
        variants[variant],
        className,
      )}
      {...props}
    />
  );
}
