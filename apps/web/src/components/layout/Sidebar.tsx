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
        'flex flex-col h-full w-64 bg-[var(--paper-2)] border-r border-[var(--rule)] select-none z-40',
        className,
      )}
    >
      <div className="flex items-center gap-3 px-6 h-16 border-b border-[var(--rule)]">
        <div className="relative flex items-center justify-center w-10 h-10 border border-[var(--ledger)] text-[var(--ledger)]">
          <svg viewBox="0 0 32 32" className="w-6 h-6" aria-hidden="true">
            <path d="M5 18 18 5l9 9-13 13-3-7-6-2Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            <path d="m8 16 8 3 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" />
          </svg>
        </div>
        <div>
          <div className="flex items-center gap-1.5">
            <span className="font-bold text-lg tracking-tight text-[var(--ink)]">PayPilot</span>
            <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.5 border border-[var(--rule)] text-[var(--ink-3)]">
              Flight desk
            </span>
          </div>
          <p className="text-[11px] text-[var(--ink-3)]">Permissioned purchase log</p>
        </div>
      </div>

      {/* Nav List */}
      <div className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-wider text-[var(--ink-3)]">
        Desk
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
                'focus-ring relative flex items-center justify-between px-3.5 py-2.5 rounded-[var(--radius)] text-sm font-medium transition-all duration-200 group',
                isActive
                  ? 'bg-[var(--ledger)] text-[var(--ledger-ink)] font-semibold shadow-[2px_3px_0_color-mix(in_srgb,var(--ink)_12%,transparent)]'
                  : 'text-[var(--ink-2)] hover:translate-x-1 hover:bg-[var(--paper)] hover:text-[var(--ink)]',
              )}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={cn(
                    'w-4 h-4 transition-colors',
                    isActive ? 'text-[var(--ledger-ink)]' : 'text-[var(--ink-3)] group-hover:text-[var(--ink)]',
                  )}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={cn(
                    'text-[10px] px-1.5 py-0.5 rounded-full font-semibold uppercase tracking-wide',
                    isActive
                      ? 'bg-[var(--ledger)] text-[var(--ledger-ink)]'
                      : 'text-[var(--brass)] border border-[var(--rule)]',
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
      <div className="p-4 mx-3 mb-3 bg-[var(--paper)] border border-[var(--rule)]">
        <div className="flex items-center gap-2 mb-1.5 text-xs font-semibold text-[var(--ink)]">
          <Sparkles className="w-3.5 h-3.5 text-[var(--brass)]" />
          <span>Rules on the record</span>
        </div>
        <p className="text-[11px] text-[var(--ink-3)] leading-relaxed">
          The ledger records what happened. Spending limits are enforced before checkout.
        </p>
      </div>

      {/* User Footer */}
      <div className="p-3 border-t border-[var(--rule)]">
        <div className="flex items-center justify-between px-3 py-2 bg-[var(--paper)] border border-[var(--rule)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-[var(--ledger)] text-[var(--ledger-ink)] font-semibold text-xs shrink-0">
              {session?.user?.name?.[0] || 'U'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[var(--ink)] truncate">
                {session?.user?.name || 'Authenticated User'}
              </div>
              <div className="text-[10px] text-[var(--ink-3)] truncate">
                {session?.user?.email || 'demo@paypilot.dev'}
              </div>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign Out"
            className="focus-ring pressable p-1.5 rounded-lg text-[var(--ink-3)] hover:text-[var(--vermilion)] hover:bg-[var(--paper-2)] transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
