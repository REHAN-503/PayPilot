'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import Image from 'next/image';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Send,
  Zap,
  ShoppingBag,
  ChevronRight,
  Package,
} from 'lucide-react';
import { DashboardShell } from '../components/layout/DashboardShell';
import { LiveAgentPanel, INITIAL_AGENT_STEPS, type AgentStep } from '../components/agent/LiveAgentPanel';
import { TrustTimeline } from '../components/timeline/TrustTimeline';
import { ApprovalSheet } from '../components/plan/ApprovalSheet';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { DEMO_PROMPTS, type PurchasePlan } from '../lib/schemas';
import type { Product } from '../lib/schemas';
import { api } from '../lib/api';
import { formatCurrency } from '../lib/utils';
import { useIntentStream, type AgentActivity } from '../hooks/useIntentStream';
import { toast } from 'sonner';

function LiveProductCard({ product }: { product: Product }) {
  const [imageFailed, setImageFailed] = React.useState(false);

  return (
    <Card className="overflow-hidden border-[var(--rule)] bg-[var(--card)]/70">
      <div className="relative aspect-[4/3] bg-[var(--paper)]">
        {product.imageUrl && !imageFailed ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            unoptimized
            className="object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="h-10 w-10 text-[var(--ink-3)]" />
          </div>
        )}
      </div>
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="outline" className="text-[10px]">
            {product.category || 'Catalog'}
          </Badge>
          <span className="text-xs text-[var(--ink-3)]">{product.stock} in stock</span>
        </div>
        <h3 className="line-clamp-2 text-sm font-semibold text-[var(--ink)]">{product.name}</h3>
        <div className="flex items-center justify-between">
          <span className="text-lg font-bold text-[var(--ink)]">{formatCurrency(product.price)}</span>
          <span className="font-mono text-[10px] text-[var(--ink-3)]">{product.sku}</span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function CommandCenterPage() {
  const [goal, setGoal] = React.useState(DEMO_PROMPTS[0].text);
  const [isPlanning, setIsPlanning] = React.useState(false);
  const [steps, setSteps] = React.useState<AgentStep[]>(INITIAL_AGENT_STEPS);
  const [currentStepId, setCurrentStepId] = React.useState<string | undefined>(undefined);
  const [activePlan, setActivePlan] = React.useState<PurchasePlan | null>(null);
  const [approvalSheetOpen, setApprovalSheetOpen] = React.useState(false);
  const [degradedMode, setDegradedMode] = React.useState(false);
  const router = useRouter();
  const { stream, isStreaming } = useIntentStream();

  // Queries
  const { data: plans, refetch: refetchPlans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.getPlans(),
  });

  const { data: policyData } = useQuery({
    queryKey: ['policy'],
    queryFn: () => api.getPolicy(),
  });

  const { data: timelineData, refetch: refetchTimeline } = useQuery({
    queryKey: ['timeline-recent'],
    queryFn: () => api.getTimeline(),
  });

  const { data: catalog, isLoading: isCatalogLoading, isError: isCatalogError } = useQuery({
    queryKey: ['products', 'catalog'],
    queryFn: () => api.getProducts({ limit: 8 }),
    staleTime: 30_000,
  });

  const updateStepStatus = React.useCallback((id: string, status: AgentStep['status'], detail?: string) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, status, detail: detail || s.detail } : s)),
    );
    if (status === 'running') setCurrentStepId(id);
  }, []);

  const applyActivity = React.useCallback((activity: AgentActivity) => {
    const detail = activity.description || activity.title;
    switch (activity.type) {
      case 'INTENT_CREATED':
      case 'INTENT_ANALYZED':
        updateStepStatus('parse', 'completed', detail);
        updateStepStatus('search', 'running');
        break;
      case 'PRODUCT_SEARCHED':
        updateStepStatus('search', 'completed', detail);
        updateStepStatus('rank', 'running');
        break;
      case 'PRODUCT_SELECTED':
      case 'PLAN_CREATED':
        updateStepStatus('rank', 'completed', detail);
        updateStepStatus('policy', 'running');
        break;
      case 'POLICY_CHECKED':
        updateStepStatus('policy', 'completed', detail);
        updateStepStatus('risk', 'running');
        break;
      case 'POLICY_BLOCKED':
        updateStepStatus('policy', 'blocked', detail);
        break;
      case 'RISK_ASSESSED':
        updateStepStatus('risk', 'completed', detail);
        updateStepStatus('ready', 'running');
        break;
      case 'APPROVAL_REQUESTED':
      case 'APPROVAL_GRANTED':
        updateStepStatus('ready', 'completed', detail);
        break;
    }
    void refetchTimeline();
  }, [refetchTimeline, updateStepStatus]);

  const handlePlanSubmit = async (textToPlan = goal) => {
    if (!textToPlan.trim()) {
      toast.error('Please enter a purchase goal');
      return;
    }

    try {
      setIsPlanning(true);
      setActivePlan(null);

      // Reset step indicators
      setSteps(
        INITIAL_AGENT_STEPS.map((s, idx) => ({
          ...s,
          status: idx === 0 ? 'running' : 'idle',
          detail: undefined,
        })),
      );
      setCurrentStepId('parse');

      toast.loading('Autonomous Agent executing plan...', { id: 'plan-progress' });
      setDegradedMode(false);

      try {
        await stream(textToPlan, {
          onActivity: applyActivity,
          onResult: (res) => {
            if (res.policyEvaluation?.decision === 'BLOCK' && (!res.plan || res.plan.status === 'REJECTED')) {
              updateStepStatus(
                'policy',
                'blocked',
                res.policyEvaluation.violations?.[0] || 'Budget exceeded',
              );
              return;
            }
            updateStepStatus(
              'ready',
              'completed',
              res.policyEvaluation?.decision === 'BLOCK'
                ? 'The first option was blocked; a compliant alternative is ready.'
                : 'Plan ready for user authorization',
            );
            toast.success(
              res.policyEvaluation?.decision === 'BLOCK' ? 'Compliant alternative ready' : 'Procurement Plan Created!',
              { id: 'plan-progress' },
            );
            if (res.plan?.id) {
              router.push(`/plans/${res.plan.id}`);
            }
          },
          onError: () => undefined,
        });
      } catch {
        setDegradedMode(true);
        toast.info('Degraded mode', {
          id: 'plan-progress',
          description: 'Streaming is unavailable; using the standard planning request.',
        });
        const res = await api.createIntent(textToPlan);
        if (res.policyEvaluation?.decision === 'BLOCK' && (!res.plan || res.plan.status === 'REJECTED')) {
          updateStepStatus(
            'policy',
            'blocked',
            res.policyEvaluation.violations?.[0] || 'Budget exceeded',
          );
        } else if (res.plan) {
          updateStepStatus(
            'ready',
            'completed',
            res.policyEvaluation?.decision === 'BLOCK'
              ? 'The first option was blocked; a compliant alternative is ready.'
              : 'Plan ready for user authorization',
          );
          setActivePlan(res.plan);
          router.push(`/plans/${res.plan.id}`);
        }
      }

      await refetchPlans();
      await refetchTimeline();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Planning Encountered Error', {
        id: 'plan-progress',
        description: message,
      });
      updateStepStatus('parse', 'blocked', message);
    } finally {
      setIsPlanning(false);
    }
  };

  const latestPlan = activePlan || plans?.[0];
  const policy = policyData?.policy;
  const metrics = policyData?.spendMetrics;

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Hero Section & Goal Input */}
        <div className="desk-enter space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-[var(--ink)] tracking-tight flex items-center gap-2.5">
                Plan a purchase
                <Badge variant="default" className="py-0.5 px-2 text-[10px]">
                  Agent v2.0
                </Badge>
              </h1>
              <p className="text-xs sm:text-sm text-[var(--ink-3)] mt-1">
                Describe what you need. Review a verified option, check the spending rules, and approve before payment.
              </p>
            </div>
          </div>

          {/* Goal Textarea Input */}
          <div className="paper-lift relative rounded-3xl p-2 bg-[var(--card)] border border-[var(--rule)] ">
            <Textarea
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="e.g. I need a developer monitor under $250. Prioritize text clarity and value."
              className="text-base sm:text-lg min-h-[100px] border-none bg-transparent focus-visible:ring-0 p-4 text-[var(--ink)] placeholder:text-[var(--ink-3)]"
            />

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-3 py-2 border-t border-[var(--rule)]">
              {/* Chips container */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 max-w-full">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--ink-3)] shrink-0">
                  Try an example:
                </span>
                {DEMO_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => {
                      setGoal(prompt.text);
                      handlePlanSubmit(prompt.text);
                    }}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius)] text-xs font-medium bg-[var(--paper-2)] hover:bg-[var(--ledger)]/20 hover:border-[var(--rule)] border border-[var(--rule)]/60 text-[var(--ink-2)] hover:text-[var(--ink)] transition-all shrink-0 cursor-pointer"
                  >
                    <span className="text-[var(--ledger)] font-mono text-[10px]">{prompt.tag}</span>
                    <span>{prompt.label}</span>
                  </button>
                ))}
              </div>

              {/* Plan It Button */}
              <Button
                variant="glow"
                size="lg"
                onClick={() => handlePlanSubmit(goal)}
                disabled={isPlanning || isStreaming}
                className="shrink-0 h-11 px-6 font-semibold"
              >
                {isPlanning ? (
                  <>
                    <Zap className="w-4 h-4 mr-2 animate-spin" />
                    Planning...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Create plan
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>

        {/* Live Agent Execution & Current Plan Grid */}
        <div className="desk-enter desk-enter-delay-1 grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left: Live Agent Stepper Panel (5 cols) */}
          <div className="lg:col-span-5">
            {degradedMode && (
              <p className="text-[11px] text-[var(--amber)]">
                Degraded mode: live activity streaming is unavailable.
              </p>
            )}
            <LiveAgentPanel steps={steps} currentStepId={currentStepId} />
          </div>

          {/* Right: Current / Latest Plan Showcase (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            {latestPlan ? (
              <Card className="border-[var(--rule)] bg-[var(--card)] overflow-hidden ">
                <CardHeader className="border-b border-[var(--rule)] bg-[var(--paper)]/40 pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge
                        variant={
                          latestPlan.status === 'APPROVED'
                            ? 'success'
                            : latestPlan.status === 'AWAITING_APPROVAL'
                            ? 'warning'
                            : 'secondary'
                        }
                      >
                        {latestPlan.status.replace('_', ' ')}
                      </Badge>
                      <span className="text-xs text-[var(--ink-3)] font-mono">
                        Plan v{latestPlan.version}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-2xl font-black text-[var(--ink)]">
                        {formatCurrency(latestPlan.total)}
                      </span>
                      <span className="text-xs text-[var(--ink-3)] ml-1.5">USD</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg font-bold text-[var(--ink)] mt-1">
                    {latestPlan.items?.[0]?.productName || 'Recommended Product Package'}
                  </CardTitle>
                </CardHeader>

                <CardContent className="p-6 space-y-5">
                  {/* Explanation rationale */}
                  <div className="p-3.5 rounded-[var(--radius)] bg-[var(--paper-2)] border border-[var(--ledger)]/20 text-xs text-[var(--ledger)] leading-relaxed">
                    <div className="font-semibold text-[var(--ledger)] mb-1 flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      Why This Pick
                    </div>
                    {latestPlan.explanation ||
                      'Selected after verified SQL search matching technical clarity and budget parameters.'}
                  </div>

                  {/* Items list */}
                  <div className="space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                      Procurement Items
                    </div>
                    {latestPlan.items?.map((it) => (
                      <div
                        key={it.id}
                        className="flex items-center justify-between p-3 rounded-[var(--radius)] bg-[var(--paper)]/60 border border-[var(--rule)] text-xs"
                      >
                        <div>
                          <div className="font-semibold text-[var(--ink)]">{it.productName}</div>
                          <div className="text-[11px] text-[var(--ink-3)]">
                            SKU: {it.productSku || 'ELEC-SKU'} • Qty: {it.quantity}
                          </div>
                        </div>
                        <div className="font-bold text-[var(--ink)] font-mono text-sm">
                          {formatCurrency(it.lineTotal)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action buttons */}
                  <div className="flex flex-wrap items-center gap-2 pt-2">
                    <Link href={`/plans/${latestPlan.id}`} className="min-w-[180px] flex-1">
                      <Button variant="outline" className="w-full text-xs px-3">
                        Review plan
                        <ArrowRight className="w-4 h-4 ml-1.5" />
                      </Button>
                    </Link>

                    {latestPlan.status === 'AWAITING_APPROVAL' && (
                      <Button
                        variant="glow"
                        onClick={() => setApprovalSheetOpen(true)}
                        className="min-w-[180px] flex-1 font-semibold"
                      >
                        <ShieldCheck className="w-4 h-4 mr-2" />
                        Authorize & Pay
                      </Button>
                    )}

                    <Link href={`/negotiation?planId=${latestPlan.id}`} className="min-w-[150px] flex-1">
                      <Button variant="accent" className="w-full">
                        Negotiate Price
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="flex flex-col items-center justify-center p-12 rounded-3xl border border-dashed border-[var(--rule)] bg-[var(--card)]/30 text-center">
                <ShoppingBag className="w-12 h-12 text-[var(--ink-3)] mb-3" />
                <h3 className="text-base font-semibold text-[var(--ink-2)]">No active plan generated yet</h3>
                <p className="text-xs text-[var(--ink-3)] max-w-sm mt-1">
                  Describe a purchase above or choose an example to create your first plan.
                </p>
              </div>
            )}

            {/* Quick Metrics Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-[var(--radius)] bg-[var(--card)]/70 border border-[var(--rule)]">
                <div className="text-[11px] text-[var(--ink-3)] uppercase font-semibold">Daily Limit Left</div>
                <div className="text-lg font-bold text-[var(--ink)] mt-1">
                  {formatCurrency(metrics?.dailyRemaining ?? 1000)}
                </div>
              </div>

              <div className="p-4 rounded-[var(--radius)] bg-[var(--card)]/70 border border-[var(--rule)]">
                <div className="text-[11px] text-[var(--ink-3)] uppercase font-semibold">Max Transaction</div>
                <div className="text-lg font-bold text-[var(--ink)] mt-1">
                  {formatCurrency(policy?.maxTransactionAmount ?? 500)}
                </div>
              </div>

              <div className="p-4 rounded-[var(--radius)] bg-[var(--card)]/70 border border-[var(--rule)]">
                <div className="text-[11px] text-[var(--ink-3)] uppercase font-semibold">Autonomy Mode</div>
                <div className="text-sm font-bold text-[var(--ledger)] mt-1.5 truncate">
                  {policy?.autonomyMode?.replace(/_/g, ' ') || 'ASK EVERY TIME'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Trust Timeline Section */}
        <div className="space-y-4 pt-4 border-t border-[var(--rule)]">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[var(--ink)] flex items-center gap-2">
                Recent Audit Timeline
                <span className="text-xs font-normal text-[var(--ink-3)] font-mono">
                  ({timelineData?.count || 0} events recorded)
                </span>
              </h2>
              <p className="text-xs text-[var(--ink-3)]">Cryptographically verifiable execution trace</p>
            </div>

            <Link href="/timeline">
              <Button variant="ghost" size="sm" className="text-xs text-[var(--ledger)] hover:text-[var(--ink)]">
                View Full Timeline
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </div>

          <TrustTimeline events={timelineData?.events?.slice(-6) || []} isLive={true} />
        </div>
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[var(--ink)]">Browse the catalog</h2>
              <p className="text-xs text-[var(--ink-3)]">
                Products and availability are loaded from the API database.
              </p>
            </div>
            {catalog?.pagination.total !== undefined && (
              <span className="text-xs text-[var(--ink-3)]">{catalog.pagination.total} products</span>
            )}
          </div>
          {isCatalogLoading ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="aspect-[3/4] animate-pulse rounded-2xl bg-[var(--card)]" />
              ))}
            </div>
          ) : isCatalogError ? (
            <div className="rounded-2xl border border-[var(--vermilion)]/30 bg-[var(--vermilion)]/5 p-4 text-sm text-[var(--vermilion)]">
              The live product catalog is unavailable. Try again after the API is running.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {catalog?.data.map((product) => <LiveProductCard key={product.id} product={product} />)}
            </div>
          )}
        </section>
      </div>

      {/* Approval Sheet Modal */}
      {latestPlan && (
        <ApprovalSheet
          open={approvalSheetOpen}
          onOpenChange={setApprovalSheetOpen}
          plan={latestPlan}
          onPlanUpdated={(updated) => {
            setActivePlan(updated);
            refetchPlans();
          }}
        />
      )}
    </DashboardShell>
  );
}
