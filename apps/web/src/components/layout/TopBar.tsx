'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
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

  const policy = policyData?.policy;
  const metrics = policyData?.spendMetrics;

  const dailyRemaining = metrics?.dailyRemaining ?? (policy?.dailySpendingLimit ? Number(policy.dailySpendingLimit) : 1000);
  const dailyLimit = policy?.dailySpendingLimit ? Number(policy.dailySpendingLimit) : 1000;
  const percentRemaining = Math.max(0, Math.min(100, Math.round((dailyRemaining / dailyLimit) * 100)));

  const autonomyMode = policy?.autonomyMode || 'ASK_EVERY_TIME';

  return (
    <header className="h-16 px-4 sm:px-6 flex items-center justify-between bg-[#0a0f1d]/90 backdrop-blur-md border-b border-slate-800/80 sticky top-0 z-30">
      {/* Mobile Menu & Quick Title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="md:hidden p-2 rounded-xl text-slate-300 hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Sandbox Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-medium">
          <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" />
          <span className="hidden sm:inline">PayPal Sandbox</span>
          <span className="text-amber-400/80 text-[11px]">— No real money</span>
        </div>
      </div>

      {/* Right Controls: Budget & Autonomy Pill */}
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Budget Metric Ring / Pill */}
        <Link
          href="/policy"
          className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-700 transition-all text-xs group"
          title="Daily Spending Limit"
        >
          <div className="relative flex items-center justify-center w-6 h-6">
            <svg className="w-6 h-6 -rotate-90">
              <circle
                cx="12"
                cy="12"
                r="9"
                className="stroke-slate-800"
                strokeWidth="2.5"
                fill="none"
              />
              <circle
                cx="12"
                cy="12"
                r="9"
                className="stroke-blue-500 transition-all duration-500"
                strokeWidth="2.5"
                strokeDasharray="56.5"
                strokeDashoffset={56.5 - (56.5 * percentRemaining) / 100}
                fill="none"
              />
            </svg>
            <Coins className="w-2.5 h-2.5 text-blue-400 absolute" />
          </div>
          <div>
            <div className="text-[10px] text-slate-400 leading-none">Daily Left</div>
            <div className="font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
              {formatCurrency(dailyRemaining)}
            </div>
          </div>
        </Link>

        {/* Autonomy Mode Pill */}
        <Link href="/policy" className="cursor-pointer">
          {autonomyMode === 'AUTO_WITHIN_LIMITS' ? (
            <Badge
              variant="default"
              className="py-1 px-3 gap-1.5 bg-blue-600/20 text-blue-400 border-blue-500/30 hover:bg-blue-600/30 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-blue-400" />
              <span className="font-semibold text-xs">Auto-Execute Mode</span>
            </Badge>
          ) : (
            <Badge
              variant="warning"
              className="py-1 px-3 gap-1.5 bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25 transition-colors"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-amber-400" />
              <span className="font-semibold text-xs">Ask Every Time</span>
            </Badge>
          )}
        </Link>
      </div>
    </header>
  );
}

