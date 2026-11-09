'use client';

import React from 'react';
import {
  Sparkles,
  Search,
  CheckCircle2,
  ShieldCheck,
  AlertTriangle,
  CreditCard,
  FileText,
  Clock,
  Layers,
} from 'lucide-react';
import type { AgentActivity } from '../types';

interface TimelineViewProps {
  activities: AgentActivity[];
}

export function TimelineView({ activities = [] }: TimelineViewProps) {
  if (activities.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-200 p-6 text-center text-xs text-zinc-400 dark:border-zinc-800">
        No agent activity recorded yet. Describe a purchase goal to begin.
      </div>
    );
  }

  function getIcon(type: string) {
    switch (type) {
      case 'INTENT_CREATED':
      case 'INTENT_ANALYZED':
        return <Sparkles className="h-3.5 w-3.5 text-blue-500" />;
      case 'PRODUCT_SEARCHED':
        return <Search className="h-3.5 w-3.5 text-sky-500" />;
      case 'PRODUCT_SELECTED':
      case 'PLAN_CREATED':
      case 'PLAN_REVISED':
        return <Layers className="h-3.5 w-3.5 text-indigo-500" />;
      case 'POLICY_CHECKED':
        return <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />;
      case 'RISK_ASSESSED':
        return <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />;
      case 'APPROVAL_REQUESTED':
      case 'APPROVAL_GRANTED':
      case 'APPROVAL_REJECTED':
        return <CheckCircle2 className="h-3.5 w-3.5 text-purple-500" />;
      case 'PAYMENT_CREATED':
      case 'PAYMENT_CAPTURED':
        return <CreditCard className="h-3.5 w-3.5 text-[#0070BA]" />;
      case 'WEBHOOK_RECEIVED':
        return <FileText className="h-3.5 w-3.5 text-teal-500" />;
      default:
        return <Clock className="h-3.5 w-3.5 text-zinc-400" />;
    }
  }

  return (
    <div className="flow-root">
      <ul className="-mb-8">
        {activities.map((activity, idx) => {
          const isLast = idx === activities.length - 1;
          const dateStr = new Date(activity.createdAt).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          });

          return (
            <li key={activity.id || idx}>
              <div className="relative pb-6">
                {!isLast && (
                  <span
                    className="absolute left-3.5 top-4 -ml-px h-full w-0.5 bg-zinc-200 dark:bg-zinc-800"
                    aria-hidden="true"
                  />
                )}
                <div className="relative flex items-start space-x-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-100 ring-4 ring-white dark:bg-zinc-900 dark:ring-zinc-950">
                    {getIcon(activity.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-zinc-900 dark:text-white">
                        {activity.title}
                      </span>
                      <time className="font-mono text-[11px] text-zinc-400">
                        {dateStr}
                      </time>
                    </div>
                    {activity.description && (
                      <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
                        {activity.description}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
