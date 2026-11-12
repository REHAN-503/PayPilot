'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Target,
  FileCheck2,
  Terminal,
  ShieldCheck,
  AlertTriangle,
  UserCheck,
  CreditCard,
  Webhook,
  Database,
  Handshake,
  ShieldBan,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Bot,
} from 'lucide-react';
import type { TimelineEvent } from '../../lib/schemas';
import { cn, formatDate } from '../../lib/utils';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { toast } from 'sonner';

interface TrustTimelineProps {
  events: TimelineEvent[];
  isLive?: boolean;
  compact?: boolean;
  className?: string;
}

export function TrustTimeline({ events, isLive = false, compact = false, className }: TrustTimelineProps) {
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = React.useState<string | null>(null);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyEvidence = (id: string, data: unknown) => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
    setCopiedId(id);
    toast.success('Audit evidence copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getStageIcon = (stage: string, status: string) => {
    if (status === 'blocked') return <ShieldBan className="w-4 h-4 text-[var(--vermilion)]" />;

    switch (stage) {
      case 'INTENT':
        return <Target className="w-4 h-4 text-[var(--ledger)]" />;
      case 'PLAN':
        return <FileCheck2 className="w-4 h-4 text-[var(--brass)]" />;
      case 'TOOL':
        return <Terminal className="w-4 h-4 text-[var(--verdigris)]" />;
      case 'POLICY':
        return <ShieldCheck className="w-4 h-4 text-[var(--verdigris)]" />;
      case 'RISK':
        return <AlertTriangle className="w-4 h-4 text-[var(--amber)]" />;
      case 'APPROVAL':
        return <UserCheck className="w-4 h-4 text-[var(--ledger)]" />;
      case 'PAYPAL':
        return <CreditCard className="w-4 h-4 text-[var(--ledger)]" />;
      case 'WEBHOOK':
        return <Webhook className="w-4 h-4 text-[var(--verdigris)]" />;
      case 'LEDGER':
        return <Database className="w-4 h-4 text-[var(--brass)]" />;
      case 'NEGOTIATION':
        return <Handshake className="w-4 h-4 text-[var(--brass)]" />;
      default:
        return <Bot className="w-4 h-4 text-[var(--ink-3)]" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ok':
        return <Badge variant="success">Verified</Badge>;
      case 'warn':
        return <Badge variant="warning">Flagged</Badge>;
      case 'blocked':
        return <Badge variant="destructive">Blocked</Badge>;
      case 'pending':
        return <Badge variant="secondary">In Progress</Badge>;
      default:
        return <Badge variant="outline">Recorded</Badge>;
    }
  };

  // Compact mode — simple list for dashboard preview
  if (compact) {
    return (
      <div className={cn('space-y-2', className)}>
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-3 group">
            <div className={cn(
              'w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5 border',
              event.status === 'blocked' ? 'border-[var(--vermilion)] bg-[var(--vermilion)]/10' :
              event.status === 'warn' ? 'border-[var(--amber)] bg-[var(--amber)]/10' :
              'border-[var(--rule)] bg-[var(--paper-2)]',
            )}>
              {getStageIcon(event.stage, event.status)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-[var(--ink)] truncate">{event.title}</span>
                <span className={cn(
                  'text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wide',
                  event.status === 'ok' ? 'bg-[var(--verdigris)]/12 text-[var(--verdigris)]' :
                  event.status === 'warn' ? 'bg-[var(--amber)]/12 text-[var(--amber)]' :
                  event.status === 'blocked' ? 'bg-[var(--vermilion)]/12 text-[var(--vermilion)]' :
                  'bg-[var(--paper-2)] text-[var(--ink-3)]',
                )}>
                  {event.status}
                </span>
              </div>
              <p className="text-[10px] text-[var(--ink-3)] mt-0.5 truncate">{event.explanation}</p>
            </div>
            <span className="text-[10px] text-[var(--ink-3)] shrink-0 font-mono">
              {new Date(event.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    );
  }

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--card)]/40 text-center">
        <Bot className="w-10 h-10 text-[var(--ink-3)] mb-3" />
        <h4 className="text-sm font-semibold text-[var(--ink-2)]">No audit events recorded yet</h4>
        <p className="text-xs text-[var(--ink-3)] max-w-sm mt-1">
          When autonomous planning, policy checks, or payments run, the complete cryptographic trace will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('relative space-y-4', className)}>
      {isLive && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--radius)] bg-[var(--ledger)]/10 border border-[var(--ledger)]/20 text-xs text-[var(--ledger)] w-fit mb-4">
          <span className="relative flex h-2 w-2">
            <span className="hidden" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--ledger)]" />
          </span>
          <span className="font-medium">Live SSE Audit Stream Active</span>
        </div>
      )}

      {/* Stepper Timeline Container */}
      <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-[var(--ledger)] space-y-6">
        <AnimatePresence initial={false}>
          {events.map((event, index) => {
            const isExpanded = expandedIds.has(event.id);
            const isBlocked = event.status === 'blocked';
            const hasData = event.data && Object.keys(event.data).length > 0;

            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.03 }}
                className="relative group"
              >
                {/* Node Step Icon */}
                <div
                  className={cn(
                    'absolute -left-6 sm:-left-8 top-1 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border  transition-transform group-hover:scale-110',
                    isBlocked
                      ? 'bg-[var(--paper-2)] border-[var(--vermilion)] '
                      : event.status === 'warn'
                      ? 'bg-[var(--paper-2)] border-[var(--amber)] shadow-amber-900/40'
                      : event.status === 'pending'
                      ? 'bg-[var(--paper-2)] border-[var(--ledger)]  animate-pulse'
                      : 'bg-[var(--card)] border-[var(--rule)] ',
                  )}
                >
                  {getStageIcon(event.stage, event.status)}
                </div>

                {/* Event Card */}
                <div
                  className={cn(
                    'p-4 rounded-[var(--radius)] border transition-all',
                    isBlocked
                      ? 'bg-[var(--paper-2)] border-[var(--vermilion)] hover:border-[var(--vermilion)]'
                      : 'bg-[var(--card)]/70 border-[var(--rule)] hover:border-[var(--rule)] ',
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-[var(--ink)]">
                        {event.title}
                      </span>
                      {getStatusBadge(event.status)}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-[var(--ink-3)]">
                      <span className="font-mono px-2 py-0.5 rounded bg-[var(--paper-2)] text-[var(--ink-2)]">
                        {event.actor}
                      </span>
                      <span>•</span>
                      <time>{formatDate(event.at)}</time>
                    </div>
                  </div>

                  {/* Fact-based explanation */}
                  <p
                    className={cn(
                      'text-xs sm:text-sm leading-relaxed',
                      isBlocked ? 'text-[var(--vermilion)] font-medium' : 'text-[var(--ink-2)]',
                    )}
                  >
                    {event.explanation}
                  </p>

                  {/* Expandable Evidence JSON Drawer */}
                  {hasData && (
                    <div className="mt-3 pt-3 border-t border-[var(--rule)]">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleExpand(event.id)}
                          className="flex items-center gap-1.5 text-xs text-[var(--ledger)] hover:text-[var(--ledger)] font-medium transition-colors cursor-pointer"
                        >
                          <span>{isExpanded ? 'Hide audit evidence' : 'Show evidence'}</span>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>

                        {isExpanded && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => copyEvidence(event.id, event.data)}
                            className="h-7 px-2 text-xs text-[var(--ink-3)] hover:text-[var(--ink)]"
                          >
                            {copiedId === event.id ? (
                              <>
                                <Check className="w-3 h-3 text-[var(--verdigris)] mr-1" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 mr-1" />
                                Copy JSON
                              </>
                            )}
                          </Button>
                        )}
                      </div>

                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-2.5 overflow-hidden rounded-[var(--radius)] bg-[var(--paper)] p-3 border border-[var(--rule)]/90"
                        >
                          <pre className="text-[11px] font-mono text-[var(--ink-2)] overflow-x-auto max-h-56 leading-normal">
                            {JSON.stringify(event.data, null, 2)}
                          </pre>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}

