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
  className?: string;
}

export function TrustTimeline({ events, isLive = false, className }: TrustTimelineProps) {
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
    if (status === 'blocked') return <ShieldBan className="w-4 h-4 text-red-400" />;

    switch (stage) {
      case 'INTENT':
        return <Target className="w-4 h-4 text-blue-400" />;
      case 'PLAN':
        return <FileCheck2 className="w-4 h-4 text-indigo-400" />;
      case 'TOOL':
        return <Terminal className="w-4 h-4 text-emerald-400" />;
      case 'POLICY':
        return <ShieldCheck className="w-4 h-4 text-emerald-400" />;
      case 'RISK':
        return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      case 'APPROVAL':
        return <UserCheck className="w-4 h-4 text-blue-400" />;
      case 'PAYPAL':
        return <CreditCard className="w-4 h-4 text-blue-400" />;
      case 'WEBHOOK':
        return <Webhook className="w-4 h-4 text-emerald-400" />;
      case 'LEDGER':
        return <Database className="w-4 h-4 text-purple-400" />;
      case 'NEGOTIATION':
        return <Handshake className="w-4 h-4 text-violet-400" />;
      default:
        return <Bot className="w-4 h-4 text-slate-400" />;
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

  if (!events || events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 rounded-2xl border border-slate-800 bg-slate-900/40 text-center">
        <Bot className="w-10 h-10 text-slate-500 mb-3" />
        <h4 className="text-sm font-semibold text-slate-300">No audit events recorded yet</h4>
        <p className="text-xs text-slate-500 max-w-sm mt-1">
          When autonomous planning, policy checks, or payments run, the complete cryptographic trace will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className={cn('relative space-y-4', className)}>
      {isLive && (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 w-fit mb-4">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
          </span>
          <span className="font-medium">Live SSE Audit Stream Active</span>
        </div>
      )}

      {/* Stepper Timeline Container */}
      <div className="relative pl-6 sm:pl-8 before:absolute before:left-3 sm:before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-gradient-to-b before:from-blue-600 before:via-indigo-500/40 before:to-slate-800 space-y-6">
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
                    'absolute -left-6 sm:-left-8 top-1 flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-full border shadow-lg transition-transform group-hover:scale-110',
                    isBlocked
                      ? 'bg-red-950/80 border-red-500/60 shadow-red-900/40'
                      : event.status === 'warn'
                      ? 'bg-amber-950/80 border-amber-500/60 shadow-amber-900/40'
                      : event.status === 'pending'
                      ? 'bg-blue-950/80 border-blue-500/60 shadow-blue-900/40 animate-pulse'
                      : 'bg-slate-900 border-slate-700/80 shadow-slate-950',
                  )}
                >
                  {getStageIcon(event.stage, event.status)}
                </div>

                {/* Event Card */}
                <div
                  className={cn(
                    'p-4 rounded-2xl border transition-all',
                    isBlocked
                      ? 'bg-red-950/20 border-red-900/40 hover:border-red-500/50'
                      : 'bg-slate-900/70 border-slate-800/80 hover:border-slate-700/80 shadow-md',
                  )}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-slate-100">
                        {event.title}
                      </span>
                      {getStatusBadge(event.status)}
                    </div>
                    <div className="flex items-center gap-2 text-[11px] text-slate-400">
                      <span className="font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300">
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
                      isBlocked ? 'text-red-300 font-medium' : 'text-slate-300',
                    )}
                  >
                    {event.explanation}
                  </p>

                  {/* Expandable Evidence JSON Drawer */}
                  {hasData && (
                    <div className="mt-3 pt-3 border-t border-slate-800/60">
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => toggleExpand(event.id)}
                          className="flex items-center gap-1.5 text-xs text-blue-400 hover:text-blue-300 font-medium transition-colors cursor-pointer"
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
                            className="h-7 px-2 text-xs text-slate-400 hover:text-white"
                          >
                            {copiedId === event.id ? (
                              <>
                                <Check className="w-3 h-3 text-emerald-400 mr-1" />
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
                          className="mt-2.5 overflow-hidden rounded-xl bg-slate-950 p-3 border border-slate-800/90"
                        >
                          <pre className="text-[11px] font-mono text-slate-300 overflow-x-auto max-h-56 leading-normal">
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

