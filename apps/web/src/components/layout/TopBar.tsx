'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ShieldAlert,
  SlidersHorizontal,
  Menu,
  Coins,
  CheckCircle2,
  Bell,
  Search,
  Moon,
  Sun,
  Pause,
  Play,
  Cpu,
} from 'lucide-react';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

interface TopBarProps {
  onMenuClick?: () => void;
  notificationCount?: number;
}

export function TopBar({ onMenuClick, notificationCount = 0 }: TopBarProps) {
  const router = useRouter();
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
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [searchVal, setSearchVal] = React.useState('');

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
  const percentUsed = Math.max(0, Math.min(100, Math.round(((dailyLimit - dailyRemaining) / dailyLimit) * 100)));
  const percentRemaining = 100 - percentUsed;

  const autonomyMode = policy?.autonomyMode || 'ASK_EVERY_TIME';

  const toggleTheme = () => {
    const next = theme === 'day' ? 'night' : 'day';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    window.localStorage.setItem('paypilot-theme', next);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchVal.trim()) {
      router.push(`/store?search=${encodeURIComponent(searchVal.trim())}`);
      setSearchOpen(false);
      setSearchVal('');
    }
  };

  return (
    <header className="topbar-blur min-h-[62px] px-3 sm:px-5 py-2 flex items-center justify-between gap-3 border-b border-[var(--rule)] sticky top-0 z-30">
      {/* Left: Mobile menu + branding context */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuClick}
          className="focus-ring pressable md:hidden p-2 rounded-[10px] text-[var(--ink-2)] hover:bg-[var(--paper-2)] transition-colors"
          aria-label="Open sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Sandbox / Mode indicator */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border border-[var(--rule)] bg-[var(--paper-2)]/60 text-[var(--ink-3)] text-[11px] font-medium">
          <ShieldAlert className="w-3.5 h-3.5 text-[var(--amber)] shrink-0" />
          <span className="hidden sm:inline font-semibold">Sandbox</span>
          <span className="hidden md:inline text-[var(--ink-3)]">· test only</span>
        </div>

        {/* LLM status badges — hidden on small screens */}
        <div className="hidden lg:flex items-center gap-1.5">
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-1 rounded-[6px] text-[10px] font-semibold border',
            configHealth?.llmMode === 'live' || configHealth?.llmMode === 'live+fallback'
              ? 'bg-[var(--verdigris)]/10 text-[var(--verdigris)] border-[var(--verdigris)]/30'
              : 'bg-[var(--paper-2)] text-[var(--ink-3)] border-[var(--rule)]',
          )}>
            <Cpu className="w-3 h-3" />
            {configHealth?.llmMode ?? 'fixture'}
          </span>
        </div>
      </div>

      {/* Center: Search bar */}
      <div className="hidden md:flex flex-1 max-w-sm mx-4">
        {searchOpen ? (
          <form onSubmit={handleSearch} className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--ink-3)]" />
            <input
              autoFocus
              value={searchVal}
              onChange={(e) => setSearchVal(e.target.value)}
              onBlur={() => { if (!searchVal) setSearchOpen(false); }}
              placeholder="Search products, plans..."
              className="w-full pl-9 pr-4 py-2 text-sm rounded-[10px] border border-[var(--ledger)]/50 bg-[var(--card)] text-[var(--ink)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--ledger)]/30 transition-all"
            />
          </form>
        ) : (
          <button
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-2.5 px-3 py-2 w-full rounded-[10px] border border-[var(--rule)] bg-[var(--paper-2)]/60 text-[var(--ink-3)] text-sm hover:border-[var(--ledger)]/40 hover:bg-[var(--card)] transition-all group"
          >
            <Search className="w-4 h-4 shrink-0 group-hover:text-[var(--ledger)] transition-colors" />
            <span className="text-[13px]">Search products &amp; plans...</span>
            <kbd className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-[var(--rule)] font-mono">⌘K</kbd>
          </button>
        )}
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="focus-ring pressable p-2 rounded-[10px] text-[var(--ink-3)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] transition-colors"
          aria-label={theme === 'day' ? 'Switch to dark mode' : 'Switch to light mode'}
          title={theme === 'day' ? 'Dark mode' : 'Light mode'}
        >
          {theme === 'day' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
        </button>

        {/* Agent pause toggle */}
        <button
          className={cn(
            'focus-ring pressable hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] border text-[11px] font-semibold transition-all',
            policy?.agentPaused
              ? 'bg-[var(--vermilion)]/10 border-[var(--vermilion)]/40 text-[var(--vermilion)] hover:bg-[var(--vermilion)]/20'
              : 'bg-[var(--paper-2)] border-[var(--rule)] text-[var(--ink-3)] hover:bg-[var(--paper)] hover:text-[var(--ink)]',
          )}
          onClick={() => {
            const next = !policy?.agentPaused;
            if (next && !window.confirm('Pause all agent approval and payment actions?')) return;
            pauseMutation.mutate(next);
          }}
          title={policy?.agentPaused ? 'Agent is paused — click to resume' : 'Pause agent'}
        >
          {policy?.agentPaused ? (
            <><Play className="w-3 h-3" /> Resume</>
          ) : (
            <><Pause className="w-3 h-3" /> Pause</>
          )}
        </button>

        {/* Daily budget ring pill */}
        <Link
          href="/policy"
          className="focus-ring pressable hidden md:flex items-center gap-2 px-3 py-2 rounded-[10px] bg-[var(--card)] border border-[var(--rule)] hover:border-[var(--brass)]/50 hover:bg-[var(--paper-2)] transition-all group"
          title={`Daily budget: ${formatCurrency(dailyRemaining)} remaining`}
        >
          <div className="relative flex items-center justify-center w-6 h-6 shrink-0">
            <svg className="w-6 h-6 -rotate-90" viewBox="0 0 24 24">
              <circle cx="12" cy="12" r="9" className="stroke-[var(--rule)]" strokeWidth="2.5" fill="none" />
              <circle
                cx="12" cy="12" r="9"
                stroke="var(--brass)"
                strokeWidth="2.5"
                strokeDasharray="56.5"
                strokeDashoffset={56.5 - (56.5 * percentRemaining) / 100}
                fill="none"
                strokeLinecap="round"
                style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(.22,1,.36,1)' }}
              />
            </svg>
            <Coins className="w-2.5 h-2.5 text-[var(--brass)] absolute" />
          </div>
          <div className="hidden sm:block">
            <div className="text-[10px] text-[var(--ink-3)] leading-none">Daily left</div>
            <div className="text-xs font-bold text-[var(--ink)] group-hover:text-[var(--brass)] transition-colors font-mono">
              {formatCurrency(dailyRemaining)}
            </div>
          </div>
        </Link>

        {/* Autonomy mode pill */}
        <Link href="/policy" className="focus-ring hidden lg:block">
          {autonomyMode === 'AUTO_WITHIN_LIMITS' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold bg-[var(--verdigris)]/12 text-[var(--verdigris)] border border-[var(--verdigris)]/30 hover:bg-[var(--verdigris)]/20 transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Auto-Execute
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-[8px] text-[11px] font-semibold bg-[var(--amber)]/10 text-[var(--amber)] border border-[var(--amber)]/30 hover:bg-[var(--amber)]/20 transition-colors">
              <SlidersHorizontal className="w-3.5 h-3.5" />
              Ask Every Time
            </span>
          )}
        </Link>

        {/* Notifications bell */}
        <Link
          href="/notifications"
          className="focus-ring pressable relative p-2 rounded-[10px] text-[var(--ink-3)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)] transition-colors"
          aria-label="Notifications"
        >
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="notif-badge">{notificationCount > 9 ? '9+' : notificationCount}</span>
          )}
        </Link>
      </div>
    </header>
  );
}
