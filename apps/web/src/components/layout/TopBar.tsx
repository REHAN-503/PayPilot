'use client';

import * as React from 'react';
import Link from 'next/link';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  SlidersHorizontal,
  Menu,
  Coins,
  CheckCircle2,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Badge } from '../ui/badge';

export function TopBar({ onMenuClick }: { onMenuClick?: () => void }) {
  const { data: policyData } = useQuery({
    queryKey: ['policy'],
    queryFn: () => api.getPolicy(),
  });
  const { data: configHealth } = useQuery({
    queryKey: ['config-health'],
    queryFn: () => api.getConfigHealth(),
    staleTime: 30_000,
  });
  const queryClient = useQueryClient();
  const [theme, setTheme] = React.useState<'day' | 'night'>('day');
  React.useEffect(() => {
    const storedTheme = window.localStorage.getItem('paypilot-theme');
    if (storedTheme === 'night') {
      window.requestAnimationFrame(() => setTheme('night'));
    }
  }, []);
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);
  const pauseMutation = useMutation({
    mutationFn: (agentPaused: boolean) => api.updatePolicy({ agentPaused }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['policy'] }),
  });

  const policy = policyData?.policy;
  const metrics = policyData?.spendMetrics;

  const dailyRemaining = metrics?.dailyRemaining ?? (policy?.dailySpendingLimit ? Number(policy.dailySpendingLimit) : 1000);
  const dailyLimit = policy?.dailySpendingLimit ? Number(policy.dailySpendingLimit) : 1000;
  const percentRemaining = Math.max(0, Math.min(100, Math.round((dailyRemaining / dailyLimit) * 100)));

  const autonomyMode = policy?.autonomyMode || 'ASK_EVERY_TIME';
  const toggleTheme = () => {
    const next = theme === 'day' ? 'night' : 'day';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem('paypilot-theme', next);
  };

  return (
    <header className="min-h-16 px-3 sm:px-6 py-2 flex items-center justify-between gap-3 bg-[var(--paper)]/95 backdrop-blur-sm border-b border-[var(--rule)] sticky top-0 z-30">
      {/* Mobile Menu & Quick Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="focus-ring pressable md:hidden p-2 rounded-[var(--radius)] text-[var(--ink-2)] hover:bg-[var(--paper-2)]"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Sandbox Badge */}
        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 border border-[var(--rule)] text-[var(--ink-2)] text-xs font-medium">
          <ShieldAlert className="w-3.5 h-3.5 text-[var(--amber)] shrink-0" />
          <span className="hidden sm:inline">Flight desk</span>
          <span className="hidden sm:inline text-[var(--ink-3)] text-[11px]">— sandbox ledger</span>
        </div>
      </div>

      {/* Right Controls: Budget & Autonomy Pill */}
      <div className="flex items-center gap-1.5 sm:gap-4">
        <button
          type="button"
          onClick={toggleTheme}
          className="hidden sm:inline-flex items-center gap-1.5 border border-[var(--rule)] px-2.5 py-1.5 text-[10px] uppercase tracking-wider text-[var(--ink-3)] hover:text-[var(--ink)]"
          aria-label="Toggle desk theme"
        >
          {theme === 'day' ? 'Night desk' : 'Day desk'}
        </button>
        <div className="hidden lg:flex items-center gap-1.5">
          <Badge variant="outline" className="text-[10px]">
            LLM {configHealth?.llmMode ?? '...'}
          </Badge>
          <Badge variant="outline" className="text-[10px]">
            PayPal {configHealth?.paypalMode ?? '...'}
          </Badge>
          {configHealth?.simulatorEnabled && (
            <Badge variant="warning" className="text-[10px]">
              Simulator
            </Badge>
          )}
        </div>
        <button
          type="button"
          className={`hidden md:inline-flex rounded-lg border px-2 py-1 text-[10px] ${policy?.agentPaused ? 'border-[var(--vermilion)] text-[var(--vermilion)]' : 'border-[var(--rule)] text-[var(--ink-3)]'}`}
          onClick={() => {
            const next = !policy?.agentPaused;
            if (next && !window.confirm('Pause all agent approval and payment actions?')) return;
            pauseMutation.mutate(next);
          }}
        >
          {policy?.agentPaused ? 'Agent paused' : 'Pause agent'}
        </button>
        {/* Budget Metric Ring / Pill */}
        <Link
          href="/policy"
          className="focus-ring pressable flex items-center gap-2.5 px-2 sm:px-3 py-1.5 bg-[var(--card)] border border-[var(--rule)] hover:border-[var(--brass)] transition-colors text-xs group"
          title="Daily Spending Limit"
        >
          <div className="relative flex items-center justify-center w-6 h-6">
            <svg className="w-6 h-6 -rotate-90">
              <circle
                cx="12"
                cy="12"
                r="9"
                className="stroke-[var(--rule)]"
                strokeWidth="2.5"
                fill="none"
              />
              <circle
                cx="12"
                cy="12"
                r="9"
                className="stroke-[var(--brass)] transition-all duration-500"
                strokeWidth="2.5"
                strokeDasharray="56.5"
                strokeDashoffset={56.5 - (56.5 * percentRemaining) / 100}
                fill="none"
              />
            </svg>
            <Coins className="w-2.5 h-2.5 text-[var(--brass)] absolute" />
          </div>
          <div>
            <div className="hidden sm:block text-[10px] text-[var(--ink-3)] leading-none">Daily Left</div>
            <div className="font-semibold text-[var(--ink)] group-hover:text-[var(--brass)] transition-colors">
              {formatCurrency(dailyRemaining)}
            </div>
          </div>
        </Link>

        {/* Autonomy Mode Pill */}
        <Link href="/policy" className="cursor-pointer hidden sm:block">
          {autonomyMode === 'AUTO_WITHIN_LIMITS' ? (
            <Badge
              variant="default"
              className="py-1 px-3 gap-1.5 bg-[var(--ledger)]/20 text-[var(--ledger)] border-[var(--ledger)] hover:bg-[var(--ledger)]/30 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-[var(--ledger)]" />
              <span className="font-semibold text-xs">Auto-Execute Mode</span>
            </Badge>
          ) : (
            <Badge
              variant="warning"
              className="py-1 px-3 gap-1.5 bg-[var(--amber)]/15 text-[var(--amber)] border-[var(--amber)] hover:bg-[var(--amber)]/25 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-[var(--amber)]" />
              <span className="font-semibold text-xs">Ask Every Time</span>
            </Badge>
          )}
        </Link>
      </div>
    </header>
  );
}
