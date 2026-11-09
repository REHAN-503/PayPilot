'use client';

import * as React from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  Handshake,
  Bot,
  Store,
  TrendingDown,
  CheckCircle2,
  ArrowRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { ApprovalSheet } from '../../components/plan/ApprovalSheet';
import { Button } from '../../components/ui/button';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import type { Negotiation, PurchasePlan } from '../../lib/schemas';
import { toast } from 'sonner';

function NegotiationContent() {
  const searchParams = useSearchParams();
  const planIdFromQuery = searchParams.get('planId');

  const [selectedPlanId, setSelectedPlanId] = React.useState<string>(planIdFromQuery || '');
  const [negotiation, setNegotiation] = React.useState<Negotiation | null>(null);
  const [isNegotiating, setIsNegotiating] = React.useState(false);
  const [agreedPlan, setAgreedPlan] = React.useState<PurchasePlan | null>(null);
  const [approvalSheetOpen, setApprovalSheetOpen] = React.useState(false);

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.getPlans(),
  });

  const effectivePlanId = selectedPlanId || planIdFromQuery || plans?.[0]?.id || '';
  const activePlan = plans?.find((p) => p.id === effectivePlanId);

  const handleStartNegotiation = async () => {
    if (!effectivePlanId) {
      toast.error('Please select a purchase plan to negotiate');
      return;
    }

    try {
      setIsNegotiating(true);
      setNegotiation(null);
      setAgreedPlan(null);

      toast.loading('Autonomous Buyer Agent initiating negotiation...', { id: 'neg-toast' });

      const res = await api.startNegotiation(effectivePlanId);
      setNegotiation(res);

      if (res.status === 'AGREED') {
        toast.success(`Deal Agreed at ${formatCurrency(res.agreedPrice)}!`, {
          id: 'neg-toast',
          description: `Saved ${formatCurrency(res.initialPrice - (res.agreedPrice || 0))} over ${res.roundsCount} rounds.`,
        });

        if (res.newPlan) {
          setAgreedPlan(res.newPlan);
        } else if (res.planId) {
          // fetch latest version
          const updated = await api.getPlan(res.planId);
          setAgreedPlan(updated);
        }
      } else {
        toast.info('Negotiation Concluded Without Discount', {
          id: 'neg-toast',
          description: 'Original plan price remains in effect.',
        });
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Negotiation Failed', { id: 'neg-toast', description: message });
    } finally {
      setIsNegotiating(false);
    }
  };

  const initialPrice = negotiation?.initialPrice ?? (activePlan ? Number(activePlan.total) : 289);
  const currentPrice = negotiation?.agreedPrice ?? initialPrice;
  const savings = initialPrice - currentPrice;
  const savingsPct = initialPrice > 0 ? Math.round((savings / initialPrice) * 1000) / 10 : 0;

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
              <Handshake className="w-6 h-6 text-violet-400" />
              Autonomous Agent ↔ Merchant Negotiation
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Multi-round concession bargaining. Monotone rules enforce buyer ceilings and preserve hidden merchant floors.
            </p>
          </div>

          {/* Plan Selector */}
          <div className="flex items-center gap-2">
            <select
              value={effectivePlanId}
              onChange={(e) => setSelectedPlanId(e.target.value)}
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {plans?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.items?.[0]?.productName || 'Order'} ({formatCurrency(p.total)}) - v{p.version}
                </option>
              ))}
            </select>

            <Button
              variant="glow"
              size="sm"
              onClick={handleStartNegotiation}
              disabled={isNegotiating || !effectivePlanId}
            >
              {isNegotiating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Bargaining...
                </>
              ) : (
                <>
                  <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                  Start Negotiation
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Live Animated Price Ticker Bar */}
        <div className="p-5 rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <TrendingDown className="w-6 h-6 animate-pulse" />
            </div>
            <div>
              <div className="text-[11px] uppercase font-semibold text-slate-400">
                Live Negotiated Price Ticker
              </div>
              <div className="flex items-baseline gap-3 mt-0.5">
                <span className="text-3xl font-black text-white tracking-tight font-mono">
                  {formatCurrency(currentPrice)}
                </span>
                {savings > 0 && (
                  <span className="text-sm font-bold text-emerald-400 font-mono">
                    Save {formatCurrency(savings)} ({savingsPct}%)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 text-right">
            <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Buyer Ceiling</div>
              <div className="font-bold text-blue-400 font-mono">
                {formatCurrency(negotiation?.buyerCeiling ?? initialPrice)}
              </div>
            </div>

            <div className="px-3.5 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs">
              <div className="text-[10px] text-slate-400 font-semibold uppercase">Merchant Floor</div>
              <div className="font-bold text-slate-400 font-mono italic">
                Secret (Server-Guarded)
              </div>
            </div>
          </div>
        </div>

        {/* Two-Column Agent Chat Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Buyer Agent Column */}
          <Card className="border-slate-800 bg-slate-900/70 p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
                  <Bot className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Buyer Procurement Agent</h3>
                  <p className="text-[11px] text-slate-400">Autonomous bidding within spending ceiling</p>
                </div>
              </div>
              <Badge variant="default">Buyer Bot</Badge>
            </div>

            <div className="space-y-4 flex-1">
              {negotiation ? (
                negotiation.rounds
                  .filter((r) => r.speaker === 'BUYER')
                  .map((round) => (
                    <motion.div
                      key={round.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 rounded-2xl bg-blue-950/20 border border-blue-500/30 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-blue-300">
                          Round {round.roundNumber} Offer
                        </span>
                        <span className="font-mono text-base font-black text-white">
                          {formatCurrency(round.price)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{round.rationale}</p>
                    </motion.div>
                  ))
              ) : (
                <div className="text-center py-16 text-slate-500 text-xs">
                  Click &apos;Start Negotiation&apos; to watch the Buyer Agent propose volume discount offers.
                </div>
              )}
            </div>
          </Card>

          {/* Merchant Agent Column */}
          <Card className="border-slate-800 bg-slate-900/70 p-5 shadow-xl flex flex-col">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-violet-600/20 text-violet-400 border border-violet-500/30">
                  <Store className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">Merchant Sales Agent</h3>
                  <p className="text-[11px] text-slate-400">Inventory pricing bot guarding margin floor</p>
                </div>
              </div>
              <Badge variant="agent">Merchant Bot</Badge>
            </div>

            <div className="space-y-4 flex-1">
              {negotiation ? (
                negotiation.rounds
                  .filter((r) => r.speaker === 'MERCHANT')
                  .map((round) => (
                    <motion.div
                      key={round.id}
                      initial={{ opacity: 0, x: 10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="p-4 rounded-2xl bg-violet-950/20 border border-violet-500/30 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-violet-300">
                          Round {round.roundNumber} Counter
                        </span>
                        <span className="font-mono text-base font-black text-white">
                          {formatCurrency(round.price)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-300 leading-relaxed">{round.rationale}</p>
                    </motion.div>
                  ))
              ) : (
                <div className="text-center py-16 text-slate-500 text-xs">
                  Merchant concessions and counter-offers will appear here during live bargaining.
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Final Agreement Card when Agreed */}
        {negotiation?.status === 'AGREED' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="p-6 rounded-3xl bg-gradient-to-r from-emerald-950/60 via-slate-900 to-emerald-950/60 border border-emerald-500/40 shadow-2xl"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    Mutual Agreement Reached!
                    <Badge variant="success">Finalized</Badge>
                  </h3>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Unit price negotiated down to {formatCurrency(negotiation.agreedPrice)} over{' '}
                    {negotiation.roundsCount} rounds (Saved {formatCurrency(savings)}). 15-minute price hold activated.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                {agreedPlan && (
                  <Button
                    variant="glow"
                    size="lg"
                    onClick={() => setApprovalSheetOpen(true)}
                    className="font-semibold"
                  >
                    Continue to Approval
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Approval Sheet Dialog */}
      {agreedPlan && (
        <ApprovalSheet
          open={approvalSheetOpen}
          onOpenChange={setApprovalSheetOpen}
          plan={agreedPlan}
          onPlanUpdated={(updated) => setAgreedPlan(updated)}
        />
      )}
    </DashboardShell>
  );
}

export default function NegotiationPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400">
          Loading autonomous negotiation arena...
        </div>
      }
    >
      <NegotiationContent />
    </React.Suspense>
  );
}

