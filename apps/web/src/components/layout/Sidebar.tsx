'use client';

import * as React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingBag,
  Handshake,
  Receipt,
  GitCommitHorizontal,
  ShieldCheck,
  BarChart3,
  LogOut,
  Sparkles,
  Store,
  Bell,
  MessageSquare,
  ChevronRight,
  Zap,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import { authClient } from '../../lib/auth-client';

interface NavItem {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  badgeColor?: 'blue' | 'green' | 'amber' | 'purple';
  section?: string;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard, section: 'main' },
  { label: 'Store', href: '/store', icon: Store, badge: 'Live', badgeColor: 'green', section: 'main' },
  { label: 'AI Assistant', href: '/chat', icon: MessageSquare, badge: 'New', badgeColor: 'purple', section: 'main' },
  { label: 'Plans', href: '/plans', icon: ShoppingBag, section: 'main' },
  { label: 'Negotiation', href: '/negotiation', icon: Handshake, badge: 'AI', badgeColor: 'blue', section: 'main' },
  { label: 'Transactions', href: '/transactions', icon: Receipt, section: 'finance' },
  { label: 'Activity', href: '/timeline', icon: GitCommitHorizontal, section: 'finance' },
  { label: 'Notifications', href: '/notifications', icon: Bell, section: 'finance' },
  { label: 'Policies', href: '/policy', icon: ShieldCheck, section: 'config' },
  { label: 'Analytics', href: '/analytics', icon: BarChart3, section: 'config' },
];

const sections = [
  { id: 'main', label: 'Workspace' },
  { id: 'finance', label: 'Finance' },
  { id: 'config', label: 'Configuration' },
];

const badgeColorMap = {
  blue:   'bg-[var(--ledger)]/15 text-[var(--ledger)] border-[var(--ledger)]/30',
  green:  'bg-[var(--verdigris)]/15 text-[var(--verdigris)] border-[var(--verdigris)]/30',
  amber:  'bg-[var(--amber)]/15 text-[var(--amber)] border-[var(--amber)]/30',
  purple: 'bg-[var(--purple)]/15 text-[var(--purple)] border-[var(--purple)]/30',
};

export function Sidebar({ className, onClose }: { className?: string; onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = authClient.useSession();

  const handleSignOut = async () => {
    await authClient.signOut();
    router.push('/welcome');
  };

  const userInitial = session?.user?.name?.[0]?.toUpperCase() || 'U';
  const userName = session?.user?.name || 'Demo User';
  const userEmail = session?.user?.email || 'demo@paypilot.dev';

  return (
    <aside
      className={cn(
        'sidebar-gradient flex flex-col h-full border-r border-[var(--rule)] select-none z-40 relative overflow-hidden',
        'w-[var(--sidebar-w,260px)]',
        className,
      )}
    >
      {/* Subtle top gradient glow */}
      <div
        className="pointer-events-none absolute top-0 left-0 right-0 h-32 opacity-40"
        style={{
          background: 'radial-gradient(ellipse 80% 60% at 50% -10%, var(--ledger-glow), transparent 70%)',
        }}
      />

      {/* Logo / Brand */}
      <div className="relative flex items-center gap-3 px-5 h-[62px] border-b border-[var(--rule)] shrink-0">
        <div className="relative flex items-center justify-center w-9 h-9 rounded-xl overflow-hidden shrink-0"
          style={{ background: 'linear-gradient(135deg, var(--ledger) 0%, var(--purple) 100%)' }}
        >
          <svg viewBox="0 0 32 32" className="w-5 h-5 text-white" aria-hidden="true">
            <path d="M6 19 18 7l8 8-12 12-3-5-5-3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
            <path d="m9 17 7 2.5 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 opacity-20"
            style={{ background: 'radial-gradient(circle at 30% 30%, white, transparent 60%)' }}
          />
        </div>
        <div>
          <div className="font-bold text-base tracking-tight text-[var(--ink)] flex items-center gap-1.5">
            PayPilot
            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wide bg-[var(--ledger)]/15 text-[var(--ledger)] border border-[var(--ledger)]/25">
              v2
            </span>
          </div>
          <p className="text-[10px] text-[var(--ink-3)] leading-tight mt-0.5">Autonomous spend management</p>
        </div>
      </div>

      {/* Nav items */}
      <div className="flex-1 px-3 py-4 overflow-y-auto space-y-5">
        {sections.map((section) => {
          const items = navItems.filter((n) => n.section === section.id);
          return (
            <div key={section.id}>
              <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-widest text-[var(--ink-3)]">
                {section.label}
              </div>
              <div className="space-y-0.5">
                {items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                  const badgeCls = item.badgeColor ? badgeColorMap[item.badgeColor] : badgeColorMap.blue;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={(event) => {
                        onClose?.();
                        // Checkout can return after the free web instance has slept, or
                        // after a stale client bundle was left open during deployment.
                        // A document navigation lets the browser request a fresh dashboard.
                        if (item.href === '/') {
                          event.preventDefault();
                          window.location.assign('/');
                        }
                      }}
                      className={cn(
                        'focus-ring group relative flex items-center justify-between px-3 py-2.5 rounded-[10px] text-sm font-medium transition-all duration-150',
                        isActive
                          ? 'bg-[var(--ledger)] text-white shadow-sm'
                          : 'text-[var(--ink-2)] hover:bg-[var(--paper-2)] hover:text-[var(--ink)]',
                      )}
                    >
                      {/* Active left indicator */}
                      {isActive && (
                        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-r bg-white/40" />
                      )}
                      <div className="flex items-center gap-2.5 min-w-0">
                        <Icon
                          className={cn(
                            'w-4 h-4 shrink-0 transition-colors',
                            isActive ? 'text-white' : 'text-[var(--ink-3)] group-hover:text-[var(--ink)]',
                          )}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {item.badge && (
                          <span
                            className={cn(
                              'px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border',
                              isActive ? 'bg-white/20 text-white border-white/30' : badgeCls,
                            )}
                          >
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight
                          className={cn(
                            'w-3.5 h-3.5 transition-all',
                            isActive ? 'text-white/70 opacity-100' : 'text-[var(--ink-3)] opacity-0 group-hover:opacity-100',
                          )}
                        />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Quick tip */}
      <div className="mx-3 mb-3 p-3.5 rounded-[12px] bg-[var(--ledger)]/8 border border-[var(--ledger)]/20">
        <div className="flex items-center gap-2 mb-1 text-xs font-semibold text-[var(--ledger)]">
          <Zap className="w-3.5 h-3.5" />
          <span>Spend controls active</span>
        </div>
        <p className="text-[11px] text-[var(--ink-3)] leading-relaxed">
          Every purchase follows your approval rules and spending limits.
        </p>
      </div>

      {/* User footer */}
      <div className="px-3 pb-3 border-t border-[var(--rule)] pt-3 shrink-0">
        <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-[10px] bg-[var(--paper-2)] border border-[var(--rule)] group">
          <div
            className="flex items-center justify-center w-8 h-8 rounded-full font-bold text-xs text-white shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--ledger) 0%, var(--purple) 100%)' }}
          >
            {userInitial}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold text-[var(--ink)] truncate">{userName}</div>
            <div className="text-[10px] text-[var(--ink-3)] truncate">{userEmail}</div>
          </div>
          <button
            onClick={handleSignOut}
            title="Sign Out"
            className="focus-ring p-1.5 rounded-lg text-[var(--ink-3)] hover:text-[var(--vermilion)] hover:bg-[var(--paper)] transition-colors cursor-pointer shrink-0 opacity-0 group-hover:opacity-100"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </aside>
  );
}
