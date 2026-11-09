'use client';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  GitCommitHorizontal,
  RefreshCw,
  Filter,
  ShieldCheck,
  CreditCard,
  Handshake,
  Layers,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { TrustTimeline } from '../../components/timeline/TrustTimeline';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { api } from '../../lib/api';
import { useEventStream } from '../../hooks/useEventStream';

export default function StandaloneTimelinePage() {
  const [filterStage, setFilterStage] = React.useState<string>('ALL');

  const { data: timelineData, isLoading, refetch } = useQuery({
    queryKey: ['timeline-all'],
    queryFn: () => api.getTimeline(),
  });

  const { isConnected } = useEventStream(() => {
    refetch();
  });

  const allEvents = timelineData?.events || [];

  const filteredEvents = React.useMemo(() => {
    if (filterStage === 'ALL') return allEvents;
    if (filterStage === 'POLICY') return allEvents.filter((e) => e.stage === 'POLICY' || e.stage === 'RISK');
    if (filterStage === 'PAYMENT') return allEvents.filter((e) => e.stage === 'PAYPAL' || e.stage === 'APPROVAL');
    if (filterStage === 'LEDGER') return allEvents.filter((e) => e.stage === 'LEDGER' || e.stage === 'WEBHOOK');
    if (filterStage === 'NEGOTIATION') return allEvents.filter((e) => e.stage === 'NEGOTIATION');
    return allEvents;
  }, [allEvents, filterStage]);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <GitCommitHorizontal className="w-6 h-6 text-blue-400" />
              Verifiable Trust Timeline
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              End-to-end auditability across Intent, Catalog Tool calls, Policy Gates, Approvals, and PayPal capture events.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Badge
              variant={isConnected ? 'success' : 'secondary'}
              className="gap-1.5 py-1 px-3"
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-400'
                }`}
              />
              <span>{isConnected ? 'SSE Live Stream Active' : 'Connecting Stream...'}</span>
            </Badge>

            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="text-xs text-slate-300"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            Filter:
          </span>

          <button
            onClick={() => setFilterStage('ALL')}
            className={`px-3 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              filterStage === 'ALL'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            All Events ({allEvents.length})
          </button>

          <button
            onClick={() => setFilterStage('POLICY')}
            className={`px-3 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              filterStage === 'POLICY'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Policy & Risk
          </button>

          <button
            onClick={() => setFilterStage('PAYMENT')}
            className={`px-3 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              filterStage === 'PAYMENT'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Approvals & PayPal
          </button>

          <button
            onClick={() => setFilterStage('LEDGER')}
            className={`px-3 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              filterStage === 'LEDGER'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Ledger & Webhooks
          </button>

          <button
            onClick={() => setFilterStage('NEGOTIATION')}
            className={`px-3 py-1 rounded-xl text-xs font-medium border transition-all cursor-pointer ${
              filterStage === 'NEGOTIATION'
                ? 'bg-blue-600 text-white border-blue-500 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
            }`}
          >
            Negotiations
          </button>
        </div>

        {/* Timeline Stepper Container */}
        <div className="p-6 rounded-3xl bg-slate-900/60 border border-slate-800 shadow-2xl">
          <TrustTimeline events={filteredEvents} isLive={isConnected} />
        </div>
      </div>
    </DashboardShell>
  );
}

