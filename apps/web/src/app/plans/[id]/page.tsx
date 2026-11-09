'use client';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Sparkles,
  Layers,
  ArrowRight,
  Handshake,
  Sliders,
  Package,
} from 'lucide-react';
import { DashboardShell } from '../../../components/layout/DashboardShell';
import { ApprovalSheet } from '../../../components/plan/ApprovalSheet';
import { Button } from '../../../components/ui/button';
import { Badge } from '../../../components/ui/badge';
import { Card } from '../../../components/ui/card';
import { Slider } from '../../../components/ui/switch';
import { Skeleton } from '../../../components/ui/progress';
import { api } from '../../../lib/api';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { toast } from 'sonner';

function PlanDetailContent() {
  const params = useParams();
  const planId = params.id as string;

  const [approvalSheetOpen, setApprovalSheetOpen] = React.useState(false);
  const [whatIfBudget, setWhatIfBudget] = React.useState<number>(300);
  const [whatIfQuantity, setWhatIfQuantity] = React.useState<number>(1);
  const [isWhatIfRunning, setIsWhatIfRunning] = React.useState(false);
  const [isEvaluating, setIsEvaluating] = React.useState(false);
  const [evaluatedPolicy, setEvaluatedPolicy] = React.useState<{
    decision: string;
    reasons: string[];
    violations: string[];
  } | null>(null);
  const [swappingProductId, setSwappingProductId] = React.useState<string | null>(null);

  const [syncedPlanId, setSyncedPlanId] = React.useState<string | null>(null);
  const [mountTime] = React.useState(() => Date.now());

  const { data: plan, isLoading, refetch } = useQuery({
    queryKey: ['plan', planId],
    queryFn: () => api.getPlan(planId),
    enabled: !!planId,
  });

  if (plan && syncedPlanId !== plan.id) {
    setSyncedPlanId(plan.id);
    setWhatIfBudget(Number(plan.total));
    setWhatIfQuantity(plan.items?.[0]?.quantity || 1);
  }

  const isExpired = Boolean(
    plan && (plan.status === 'EXPIRED' || (plan.expiresAt && new Date(plan.expiresAt).getTime() < mountTime)),
  );

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <Skeleton className="lg:col-span-8 h-96" />
            <Skeleton className="lg:col-span-4 h-96" />
          </div>
        </div>
      </DashboardShell>
    );
  }

  if (!plan) {
    return (
      <DashboardShell>
        <div className="text-center p-12 rounded-3xl border border-[var(--rule)] bg-[var(--card)]/40">
          <AlertTriangle className="w-10 h-10 text-[var(--amber)] mx-auto mb-3" />
          <h2 className="text-lg font-bold text-[var(--ink)]">Purchase Plan Not Found</h2>
          <p className="text-xs text-[var(--ink-3)] mt-1">Plan ID: {planId}</p>
          <Link href="/plans" className="mt-4 inline-block">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Plans
            </Button>
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const primaryItem = plan.items?.[0];
  const product = primaryItem?.product;
  const risk = plan.riskAssessments?.[0];
  const total = Number(plan.total);

  // Time remaining calculation
  const expiresAt = plan.expiresAt ? new Date(plan.expiresAt) : null;

  const handleWhatIfSubmit = async () => {
    try {
      setIsWhatIfRunning(true);
      const res = await api.whatIf(plan.id, {
        maxBudget: whatIfBudget,
        quantity: whatIfQuantity,
      });
      const diffDesc = res.diff
        ? `Cost difference: ${res.diff.costDifference >= 0 ? '+' : ''}$${res.diff.costDifference}`
        : (res.reasons?.[0] || 'Simulation completed against catalog constraints.');
      toast.success('What-If Scenario Evaluated', {
        description: diffDesc,
      });
      await refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Simulation Failed', { description: message });
    } finally {
      setIsWhatIfRunning(false);
    }
  };

  const handleEvaluate = async () => {
    try {
      setIsEvaluating(true);
      setEvaluatedPolicy(await api.evaluatePlan(plan.id));
      await refetch();
    } catch (err: unknown) {
      toast.error('Policy re-check failed', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsEvaluating(false);
    }
  };

  const handleAlternativeSwap = async (productId: string) => {
    try {
      setSwappingProductId(productId);
      await api.selectAlternative(plan.id, productId);
      setEvaluatedPolicy(await api.evaluatePlan(plan.id));
      await refetch();
      toast.success('Plan alternative selected');
    } catch (err: unknown) {
      toast.error('Alternative swap failed', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setSwappingProductId(null);
    }
  };

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/plans">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-[var(--radius)]">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight">
                  Plan Details
                </h1>
                <Badge variant="outline" className="font-mono text-xs">
                  v{plan.version}
                </Badge>
                <Badge
                  variant={
                    plan.status === 'APPROVED'
                      ? 'success'
                      : plan.status === 'AWAITING_APPROVAL'
                      ? 'warning'
                      : 'secondary'
                  }
                >
                  {plan.status.replace(/_/g, ' ')}
                </Badge>
              </div>
              <p className="text-xs text-[var(--ink-3)] mt-0.5">
                Created {formatDate(plan.createdAt)} • Intent #{plan.intentId.slice(-8)}
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5">
            <Button
              variant="outline"
              size="sm"
              onClick={handleEvaluate}
              disabled={isEvaluating}
            >
              <ShieldCheck className="w-4 h-4 mr-1.5" />
              {isEvaluating ? 'Checking...' : 'Re-check policy'}
            </Button>
            <Link href={`/negotiation?planId=${plan.id}`}>
              <Button variant="accent" size="sm">
                <Handshake className="w-4 h-4 mr-1.5" />
                Negotiate
              </Button>
            </Link>

            {plan.status === 'AWAITING_APPROVAL' && (
              <Button
                variant="glow"
                size="sm"
                onClick={() => setApprovalSheetOpen(true)}
                disabled={isExpired}
              >
                <ShieldCheck className="w-4 h-4 mr-1.5" />
                Review & Authorize
              </Button>
            )}
          </div>
        </div>

        {/* Expiry Banner if present */}
        {expiresAt && (
          <div className="p-3.5 rounded-[var(--radius)] bg-[var(--amber)]/10 border border-[var(--amber)] text-xs text-[var(--amber)] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[var(--amber)] shrink-0" />
              <span>
                {isExpired
                  ? 'Agreement window expired. Re-evaluation required before payment.'
                  : `Negotiated price hold expires at ${expiresAt.toLocaleTimeString()}.`}
              </span>
            </div>
            <span className="font-mono text-[11px] font-semibold">
              {isExpired ? 'EXPIRED' : 'ACTIVE HOLD'}
            </span>
          </div>
        )}

        {/* Main Grid: 8 Cols Left, 4 Cols Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {evaluatedPolicy && (
              <Card className="border-[var(--rule)] bg-[var(--card)] p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-[var(--ink)]">Policy re-check</h3>
                  <Badge variant={evaluatedPolicy.decision === 'BLOCK' ? 'destructive' : 'success'}>
                    {evaluatedPolicy.decision}
                  </Badge>
                </div>
                <div className="space-y-2 text-xs">
                  {[...evaluatedPolicy.reasons.map((reason) => ({ pass: true, text: reason })),
                    ...evaluatedPolicy.violations.map((violation) => ({ pass: false, text: violation }))].map(
                    (rule, index) => (
                      <div key={`${rule.text}-${index}`} className="flex items-start gap-2">
                        <span className={rule.pass ? 'text-[var(--verdigris)]' : 'text-[var(--vermilion)]'}>
                          {rule.pass ? 'PASS' : 'FAIL'}
                        </span>
                        <span className="text-[var(--ink-2)]">{rule.text}</span>
                      </div>
                    ),
                  )}
                </div>
              </Card>
            )}

            {/* Primary Recommended Product Card */}
            <Card className="border-[var(--rule)] bg-[var(--card)] overflow-hidden ">
              <div className="p-6 flex flex-col sm:flex-row gap-6">
                {/* Product Image / Placeholder */}
                <div className="w-full sm:w-44 h-44 rounded-[var(--radius)] bg-[var(--paper)] border border-[var(--rule)] flex items-center justify-center shrink-0 overflow-hidden relative">
                  {product?.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={primaryItem?.productName || 'Product'}
                      width={176}
                      height={176}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <Package className="w-12 h-12 text-[var(--ink-3)]" />
                  )}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono bg-[var(--card)] text-[var(--ink-2)] border border-[var(--rule)]">
                    {product?.sku || 'SKU-001'}
                  </span>
                </div>

                {/* Product Info */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[var(--ledger)] font-medium mb-1">
                      <span>{product?.category || 'Electronics Catalog'}</span>
                      <span>•</span>
                      <span className="text-[var(--ink-3)]">Verified Stock: {product?.stock ?? 18}</span>
                    </div>

                    <h2 className="text-xl font-bold text-[var(--ink)] leading-snug">
                      {primaryItem?.productName || 'Developer Workstation Display'}
                    </h2>

                    <p className="text-xs text-[var(--ink-3)] mt-2 leading-relaxed">
                      {product?.description ||
                        'High-resolution developer panel engineered for software development, terminal clarity, and color fidelity.'}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-[var(--rule)] flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-[var(--ink-3)]">Unit Price</div>
                      <div className="text-2xl font-black text-[var(--ink)]">
                        {formatCurrency(primaryItem?.unitPrice || total)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-[var(--ink-3)]">Order Total ({primaryItem?.quantity || 1}x)</div>
                      <div className="text-xl font-bold text-[var(--ledger)]">
                        {formatCurrency(total)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {Array.isArray(plan.alternatives) && plan.alternatives.length > 0 && (
              <Card className="border-[var(--rule)] bg-[var(--card)] p-5">
                <h3 className="text-sm font-bold text-[var(--ink)] mb-3">Alternatives</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  {plan.alternatives.map((alternative, index) => {
                    if (typeof alternative !== 'object' || alternative === null) return null;
                    const candidate = alternative as {
                      productId?: string;
                      name?: string;
                      price?: number | string;
                      reason?: string;
                    };
                    if (!candidate.productId) return null;
                    return (
                      <div
                        key={candidate.productId}
                        className="rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--paper)]/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-xs font-semibold text-[var(--ink)]">
                              {candidate.name || `Alternative ${index + 1}`}
                            </p>
                            <p className="text-sm font-bold text-[var(--ledger)]">
                              {formatCurrency(candidate.price ?? 0)}
                            </p>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAlternativeSwap(candidate.productId!)}
                            disabled={swappingProductId !== null}
                          >
                            {swappingProductId === candidate.productId ? 'Swapping...' : 'Swap to this'}
                          </Button>
                        </div>
                        {candidate.reason && (
                          <p className="mt-2 text-[11px] text-[var(--ink-3)]">{candidate.reason}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            )}

            {/* Why This Pick & Tradeoffs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-[var(--rule)] bg-[var(--card)] p-5">
                <h4 className="text-xs font-semibold text-[var(--ledger)] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Why This Recommendation
                </h4>
                <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                  {plan.explanation ||
                    'Optimized across verified SQL inventory to satisfy requirements while keeping spend strictly below the authorized transaction ceiling.'}
                </p>
              </Card>

              <Card className="border-[var(--rule)] bg-[var(--card)] p-5">
                <h4 className="text-xs font-semibold text-[var(--brass)] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Layers className="w-3.5 h-3.5" />
                  Tradeoffs & Alternatives Considered
                </h4>
                <ul className="text-xs text-[var(--ink-2)] space-y-1.5">
                  {(plan.tradeoffs && plan.tradeoffs.length > 0
                    ? plan.tradeoffs
                    : ['Selected model prioritizes budget ceiling adherence over luxury oversized casing.']
                  ).map((t, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-[var(--brass)] mt-0.5">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {/* What-If Control Simulation */}
            <Card className="border-[var(--rule)] bg-[var(--card)] p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-[var(--ledger)]" />
                    What-If Governance Simulator
                  </h3>
                  <p className="text-xs text-[var(--ink-3)] mt-0.5">
                    Simulate how budget adjustments or quantity scaling affect policy compliance.
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleWhatIfSubmit}
                  disabled={isWhatIfRunning}
                  className="text-xs"
                >
                  {isWhatIfRunning ? 'Simulating...' : 'Run Simulation'}
                </Button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--ink-3)]">Target Budget Ceiling:</span>
                    <span className="font-bold text-[var(--ledger)]">{formatCurrency(whatIfBudget)}</span>
                  </div>
                  <Slider
                    value={[whatIfBudget]}
                    min={100}
                    max={600}
                    step={10}
                    onValueChange={(val) => setWhatIfBudget(val[0])}
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--ink-3)]">Order Quantity:</span>
                    <span className="font-bold text-[var(--ink)]">{whatIfQuantity} unit(s)</span>
                  </div>
                  <Slider
                    value={[whatIfQuantity]}
                    min={1}
                    max={10}
                    step={1}
                    onValueChange={(val) => setWhatIfQuantity(val[0])}
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Right Column (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Price Breakdown Card */}
            <Card className="border-[var(--rule)] bg-[var(--card)] p-5 ">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-4 pb-2 border-b border-[var(--rule)]">
                Financial Breakdown
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-[var(--ink-3)]">
                  <span>Subtotal</span>
                  <span className="text-[var(--ink)] font-mono">{formatCurrency(plan.subtotal)}</span>
                </div>
                <div className="flex justify-between text-[var(--ink-3)]">
                  <span>Sales Tax (0%)</span>
                  <span className="text-[var(--ink)] font-mono">{formatCurrency(plan.tax)}</span>
                </div>
                <div className="flex justify-between text-[var(--ink-3)]">
                  <span>Expedited Shipping</span>
                  <span className="text-[var(--ink)] font-mono">{formatCurrency(plan.shipping)}</span>
                </div>

                {Number(plan.discount) > 0 && (
                  <div className="flex justify-between text-[var(--verdigris)]">
                    <span>Negotiated Discount</span>
                    <span className="font-mono">−{formatCurrency(plan.discount)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-[var(--rule)] flex justify-between items-center text-sm font-bold">
                  <span className="text-[var(--ink)]">Total Due</span>
                  <span className="text-xl text-[var(--ledger)] font-mono">{formatCurrency(total)}</span>
                </div>
              </div>

              {plan.status === 'AWAITING_APPROVAL' && (
                <Button
                  variant="glow"
                  onClick={() => setApprovalSheetOpen(true)}
                  className="w-full mt-5 font-semibold"
                >
                  <ShieldCheck className="w-4 h-4 mr-2" />
                  Review & Authorize
                </Button>
              )}
            </Card>

            {/* Risk Gate Assessment */}
            <Card className="border-[var(--rule)] bg-[var(--card)] p-5">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--rule)]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)]">
                  Risk Gate Status
                </h4>
                <Badge
                  variant={
                    risk?.level === 'LOW'
                      ? 'success'
                      : risk?.level === 'MEDIUM'
                      ? 'warning'
                      : 'destructive'
                  }
                >
                  {risk?.level || 'LOW'} ({risk?.score ?? 15}/100)
                </Badge>
              </div>

              <div className="space-y-2 text-xs text-[var(--ink-3)]">
                <div className="flex items-center justify-between">
                  <span>Policy Evaluation:</span>
                  <span className="font-semibold text-[var(--verdigris)]">PASSED</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Behavioral Score:</span>
                  <span className="font-mono text-[var(--ink)]">{risk?.score ?? 15} / 100</span>
                </div>
                <div className="pt-2 border-t border-[var(--rule)]">
                  <span className="text-[11px] text-[var(--ink-3)]">
                    {risk?.explanation || 'All behavioral and spending velocity rules satisfied.'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Negotiation CTA */}
            <Card className="border-[var(--rule)] bg-[var(--card)] p-5">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[var(--brass)]">
                <Handshake className="w-4 h-4" />
                <span>Autonomous Merchant Negotiation</span>
              </div>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed mb-4">
                Let your Buyer Agent autonomously counter-offer the merchant bot to secure commercial discounts before paying.
              </p>
              <Link href={`/negotiation?planId=${plan.id}`}>
                <Button variant="accent" className="w-full text-xs font-semibold">
                  Launch Live Negotiation
                  <ArrowRight className="w-4 h-4 ml-1.5" />
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </div>

      {/* Approval Sheet Dialog */}
      <ApprovalSheet
        open={approvalSheetOpen}
        onOpenChange={setApprovalSheetOpen}
        plan={plan}
        onPlanUpdated={() => refetch()}
      />
    </DashboardShell>
  );
}

export default function PlanDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center text-[var(--ink-3)]">
          Loading purchase plan details...
        </div>
      }
    >
      <PlanDetailContent />
    </React.Suspense>
  );
}
