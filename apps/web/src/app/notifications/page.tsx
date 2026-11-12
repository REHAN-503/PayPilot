'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  Receipt,
  Handshake,
  Bot,
  ShoppingBag,
  ChevronRight,
  Trash2,
  Check,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { api } from '../../lib/api';
import { formatDate, formatCurrency } from '../../lib/utils';
import { cn } from '../../lib/utils';

/* ============================================================
   TYPES
   ============================================================ */
interface Notification {
  id: string;
  type: 'payment' | 'policy' | 'plan' | 'negotiation' | 'risk' | 'approval' | 'system';
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  link?: string;
  amount?: number;
}

/* ============================================================
   GENERATE NOTIFICATIONS FROM REAL DATA
   ============================================================ */
function useNotifications() {
  const { data: plans } = useQuery({ queryKey: ['plans'], queryFn: () => api.getPlans() });
  const { data: timeline } = useQuery({ queryKey: ['timeline-recent'], queryFn: () => api.getTimeline() });
  const { data: summary } = useQuery({ queryKey: ['analytics-summary'], queryFn: () => api.getAnalyticsSummary() });

  const [readIds, setReadIds] = React.useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const stored = localStorage.getItem('pp-read-notifs');
      return stored ? new Set(JSON.parse(stored) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  const notifications = React.useMemo<Notification[]>(() => {
    const list: Notification[] = [];

    // From plans
    for (const plan of (plans ?? []).slice(0, 10)) {
      const item = plan.items?.[0];

      if (plan.status === 'AWAITING_APPROVAL') {
        list.push({
          id: `plan-approval-${plan.id}`,
          type: 'approval',
          title: 'Purchase plan awaiting your approval',
          body: `${item?.productName || 'Order'} · ${formatCurrency(plan.total)} · Please review and authorize.`,
          createdAt: plan.updatedAt ?? plan.createdAt ?? new Date().toISOString(),
          read: readIds.has(`plan-approval-${plan.id}`),
          link: `/plans/${plan.id}`,
          amount: Number(plan.total),
        });
      }

      if (plan.status === 'COMPLETED') {
        list.push({
          id: `plan-done-${plan.id}`,
          type: 'payment',
          title: 'Payment captured successfully',
          body: `${item?.productName || 'Order'} · ${formatCurrency(plan.total)} confirmed via PayPal.`,
          createdAt: plan.updatedAt ?? plan.createdAt ?? new Date().toISOString(),
          read: readIds.has(`plan-done-${plan.id}`),
          link: `/plans/${plan.id}`,
          amount: Number(plan.total),
        });
      }

      if (plan.status === 'REJECTED') {
        list.push({
          id: `plan-rejected-${plan.id}`,
          type: 'policy',
          title: 'Purchase plan was rejected',
          body: `${item?.productName || 'Order'} · ${formatCurrency(plan.total)} · Plan was not authorized.`,
          createdAt: plan.updatedAt ?? plan.createdAt ?? new Date().toISOString(),
          read: readIds.has(`plan-rejected-${plan.id}`),
          link: `/plans/${plan.id}`,
        });
      }
    }

    // From timeline
    for (const event of (timeline?.events ?? []).slice(0, 15)) {
      if (event.stage === 'WEBHOOK') {
        list.push({
          id: `webhook-${event.id}`,
          type: 'payment',
          title: 'PayPal webhook confirmed',
          body: `${event.title} — Payment finality stamp received.`,
          createdAt: event.at,
          read: readIds.has(`webhook-${event.id}`),
          link: '/transactions',
        });
      }
      if (event.stage === 'NEGOTIATION' && event.status === 'ok') {
        list.push({
          id: `neg-${event.id}`,
          type: 'negotiation',
          title: 'Negotiation completed',
          body: event.explanation,
          createdAt: event.at,
          read: readIds.has(`neg-${event.id}`),
          link: '/negotiation',
        });
      }
      if (event.stage === 'RISK' && event.status === 'warn') {
        list.push({
          id: `risk-${event.id}`,
          type: 'risk',
          title: 'Risk flag raised on transaction',
          body: event.explanation,
          createdAt: event.at,
          read: readIds.has(`risk-${event.id}`),
          link: '/timeline',
        });
      }
    }

    // System notification
    list.push({
      id: 'sys-welcome',
      type: 'system',
      title: 'Welcome to PayPilot v2.0',
      body: 'New features: AI Chat Assistant, Live Store, Notification Center, enhanced analytics. Explore the sidebar!',
      createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
      read: readIds.has('sys-welcome'),
      link: '/',
    });

    // Sort by date descending
    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [plans, timeline, readIds]);

  const markRead = (id: string) => {
    setReadIds((prev) => {
      const next = new Set(prev).add(id);
      localStorage.setItem('pp-read-notifs', JSON.stringify([...next]));
      return next;
    });
  };

  const markAllRead = () => {
    const allIds = notifications.map((n) => n.id);
    setReadIds((prev) => {
      const next = new Set([...prev, ...allIds]);
      localStorage.setItem('pp-read-notifs', JSON.stringify([...next]));
      return next;
    });
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, markRead, markAllRead, unreadCount };
}

/* ============================================================
   NOTIFICATION TYPE CONFIG
   ============================================================ */
const typeConfig: Record<Notification['type'], {
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  bg: string;
  label: string;
}> = {
  payment:     { icon: Receipt,     color: 'text-[var(--verdigris)]', bg: 'bg-[var(--verdigris)]/12',  label: 'Payment' },
  approval:    { icon: ShieldCheck, color: 'text-[var(--ledger)]',    bg: 'bg-[var(--ledger)]/12',     label: 'Approval' },
  plan:        { icon: ShoppingBag, color: 'text-[var(--brass)]',     bg: 'bg-[var(--brass)]/12',      label: 'Plan' },
  negotiation: { icon: Handshake,   color: 'text-[var(--amber)]',     bg: 'bg-[var(--amber)]/12',      label: 'Negotiation' },
  risk:        { icon: AlertTriangle,color: 'text-[var(--vermilion)]',bg: 'bg-[var(--vermilion)]/12',  label: 'Risk' },
  policy:      { icon: ShieldCheck, color: 'text-[var(--amber)]',     bg: 'bg-[var(--amber)]/12',      label: 'Policy' },
  system:      { icon: Sparkles,    color: 'text-[var(--purple)]',    bg: 'bg-[var(--purple)]/12',     label: 'System' },
};

/* ============================================================
   NOTIFICATION ITEM
   ============================================================ */
function NotificationItem({ notif, onRead }: { notif: Notification; onRead: (id: string) => void }) {
  const config = typeConfig[notif.type];
  const Icon = config.icon;

  return (
    <div
      className={cn(
        'flex items-start gap-4 p-4 rounded-[14px] border transition-all group cursor-pointer',
        !notif.read
          ? 'bg-[var(--ledger)]/4 border-[var(--ledger)]/20 hover:bg-[var(--ledger)]/8'
          : 'bg-[var(--card)] border-[var(--rule)] hover:bg-[var(--paper-2)]',
      )}
      onClick={() => {
        onRead(notif.id);
        if (notif.link) window.location.href = notif.link;
      }}
    >
      {/* Icon */}
      <div className={cn('w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 mt-0.5', config.bg)}>
        <Icon className={cn('w-5 h-5', config.color)} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn(
            'text-sm font-semibold',
            !notif.read ? 'text-[var(--ink)]' : 'text-[var(--ink-2)]',
          )}>
            {notif.title}
          </span>
          <span className={cn(
            'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
            config.bg,
            config.color,
            'border-current/30',
          )}>
            {config.label}
          </span>
          {!notif.read && (
            <span className="w-2 h-2 rounded-full bg-[var(--ledger)] shrink-0" />
          )}
        </div>
        <p className="text-xs text-[var(--ink-3)] mt-1 leading-relaxed">{notif.body}</p>
        <div className="flex items-center gap-3 mt-2">
          <span className="text-[10px] text-[var(--ink-3)]">{formatDate(notif.createdAt)}</span>
          {notif.amount && (
            <span className="text-[10px] font-mono font-semibold text-[var(--ink-2)]">{formatCurrency(notif.amount)}</span>
          )}
          {notif.link && (
            <span className="text-[10px] text-[var(--ledger)] hover:underline font-medium flex items-center gap-0.5">
              View <ChevronRight className="w-3 h-3" />
            </span>
          )}
        </div>
      </div>

      {/* Read indicator */}
      <button
        onClick={(e) => { e.stopPropagation(); onRead(notif.id); }}
        className={cn(
          'p-1.5 rounded-[6px] opacity-0 group-hover:opacity-100 transition-opacity text-[var(--ink-3)] hover:text-[var(--verdigris)] hover:bg-[var(--verdigris)]/10 shrink-0',
          notif.read && 'hidden',
        )}
        title="Mark as read"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

/* ============================================================
   NOTIFICATIONS PAGE
   ============================================================ */
export default function NotificationsPage() {
  const { notifications, markRead, markAllRead, unreadCount } = useNotifications();
  const [filter, setFilter] = React.useState<'all' | 'unread'>('all');

  const filtered = filter === 'unread' ? notifications.filter((n) => !n.read) : notifications;

  return (
    <DashboardShell>
      <div className="max-w-3xl mx-auto space-y-6">

        {/* Header */}
        <div className="desk-enter flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-[var(--ink)] flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0 relative"
                style={{ background: 'linear-gradient(135deg, var(--ledger) 0%, var(--purple) 100%)' }}>
                <Bell className="w-5 h-5 text-white" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-[var(--vermilion)] border-2 border-[var(--paper)] text-white text-[10px] font-bold flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </div>
              Notification Center
            </h1>
            <p className="text-sm text-[var(--ink-3)] mt-1">
              {unreadCount > 0
                ? `${unreadCount} unread notification${unreadCount > 1 ? 's' : ''}`
                : 'All caught up!'}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllRead}
                className="gap-2 text-[var(--verdigris)] border-[var(--verdigris)]/30 hover:bg-[var(--verdigris)]/10"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Filter tabs */}
        <div className="desk-enter desk-enter-delay-1 flex items-center gap-1.5">
          {(['all', 'unread'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-4 py-2 rounded-[10px] text-sm font-semibold transition-all border',
                filter === f
                  ? 'bg-[var(--ledger)] text-white border-[var(--ledger)]'
                  : 'bg-[var(--paper-2)] text-[var(--ink-2)] border-[var(--rule)] hover:border-[var(--ledger)]/30 hover:text-[var(--ledger)]',
              )}
            >
              {f === 'all' ? `All (${notifications.length})` : `Unread (${unreadCount})`}
            </button>
          ))}
        </div>

        {/* Notifications list */}
        <div className="desk-enter desk-enter-delay-2 space-y-2">
          {filtered.length === 0 ? (
            <div className="glow-card p-16 text-center">
              <div className="w-16 h-16 rounded-[20px] bg-[var(--paper-2)] flex items-center justify-center mx-auto mb-4">
                <BellOff className="w-8 h-8 text-[var(--ink-3)]" />
              </div>
              <h3 className="text-lg font-bold text-[var(--ink)]">
                {filter === 'unread' ? 'All caught up!' : 'No notifications yet'}
              </h3>
              <p className="text-sm text-[var(--ink-3)] mt-2">
                {filter === 'unread'
                  ? 'No unread notifications. Check back after creating a purchase plan.'
                  : 'Notifications will appear here as you use PayPilot.'}
              </p>
            </div>
          ) : (
            filtered.map((notif, i) => (
              <div key={notif.id} className="desk-enter" style={{ animationDelay: `${i * 30}ms` }}>
                <NotificationItem notif={notif} onRead={markRead} />
              </div>
            ))
          )}
        </div>

      </div>
    </DashboardShell>
  );
}
