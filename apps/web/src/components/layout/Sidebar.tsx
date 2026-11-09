'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Terminal,
  ShoppingBag,
  Handshake,
  Receipt,
  GitCommitHorizontal,
  ShieldCheck,
  BarChart3,
  LogOut,
  Sparkles,
  Bot,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { authClient } from '../../lib/auth-client';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
}

const navItems: NavItem[] = [
  { label: 'Command Center', href: '/', icon: Terminal },
  { label: 'Purchase Plans', href: '/plans', icon: ShoppingBag },
  { label: 'Agent Negotiation', href: '/negotiation', icon: Handshake, badge: 'Live AI' },
  { label: 'Transactions', href: '/transactions', icon: Receipt },
  { label: 'Trust Timeline', href: '/timeline', icon: GitCommitHorizontal },
  { label: 'Policy Center', href: '/policy', icon: ShieldCheck },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

export function Sidebar({ className, onClose }: { className?: string; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/welcome');
  };

  return (
    <aside
      className={cn(
        'flex flex-col h-full w-64 bg-[#0a0f1d] border-r border-slate-800/80 select-none z-40',
        className,
      )}
    >
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-slate-800/80">
        <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 shadow-md shadow-blue-500/25">
          <Bot className="w-5 h-5 text-white" />
          <span className="absolute -top-1 -right-1 flex h-3 w-3">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500" />
          </span>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-lg tracking-tight text-white">PayPilot</span>
            <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30">
              Agent
            </span>
          </div>
          <p className="text-[11px] text-slate-400">Autonomous PayPal Copilot</p>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Core Workflows
        </div>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                'flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group',
                isActive
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-semibold'
                  : 'text-slate-300 hover:bg-slate-800/60 hover:text-white',
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isActive ? 'text-white' : 'text-slate-400 group-hover:text-white',
                  )}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide',
                    isActive
                      ? 'bg-blue-700/60 text-white'
                      : 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </div>

      {/* Agent Governance Badge */}
      <div className="p-4 mx-3 mb-3 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-900/50 border border-slate-800">
        <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-slate-200">
          <Sparkles className="w-3.5 h-3.5 text-blue-400" />
          <span>Deterministic Guard</span>
        </div>
        <p className="text-[11px] text-slate-400 leading-relaxed">
          Zero LLM hallucination in payment ledger. Code enforces hard budget limits.
        </p>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-slate-800/80">
        <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-900/60 border border-slate-800/60">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600/20 text-blue-400 font-semibold text-xs border border-blue-500/30 shrink-0">
              {session?.user?.name?.[0] || 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-slate-200 truncate">
                {session?.user?.name || 'Authenticated User'}
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                {session?.user?.email || 'demo@paypilot.dev'}
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign Out"
            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}

