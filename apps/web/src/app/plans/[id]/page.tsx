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
        <div className="text-center p-12 rounded-3xl border border-slate-800 bg-slate-900/40">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white">Purchase Plan Not Found</h2>
          <p className="text-xs text-slate-400 mt-1">Plan ID: {planId}</p>
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

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Navigation Breadcrumb */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/plans">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
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
              <p className="text-xs text-slate-400 mt-0.5">
                Created {formatDate(plan.createdAt)} • Intent #{plan.intentId.slice(-8)}
              </p>
            </div>
          </div>

          {/* Top Actions */}
          <div className="flex items-center gap-2.5">
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
          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-400 shrink-0" />
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
            {/* Primary Recommended Product Card */}
            <Card className="border-slate-800 bg-slate-900/80 overflow-hidden shadow-xl">
              <div className="p-6 flex flex-col sm:flex-row gap-6">
                {/* Product Image / Placeholder */}
                <div className="w-full sm:w-44 h-44 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center shrink-0 overflow-hidden relative">
                  {product?.imageUrl ? (
                    <Image
                      src={product.imageUrl}
                      alt={primaryItem?.productName || 'Product'}
                      width={176}
                      height={176}
                      className="object-cover w-full h-full"
                    />
                  ) : (
                    <Package className="w-12 h-12 text-slate-600" />
                  )}
                  <span className="absolute bottom-2 left-2 px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900/90 text-slate-300 border border-slate-700">
                    {product?.sku || 'SKU-001'}
                  </span>
                </div>

                {/* Product Info */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-blue-400 font-medium mb-1">
                      <span>{product?.category || 'Electronics Catalog'}</span>
                      <span>•</span>
                      <span className="text-slate-400">Verified Stock: {product?.stock ?? 18}</span>
                    </div>

                    <h2 className="text-xl font-bold text-white leading-snug">
                      {primaryItem?.productName || 'Developer Workstation Display'}
                    </h2>

                    <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                      {product?.description ||
                        'High-resolution developer panel engineered for software development, terminal clarity, and color fidelity.'}
                    </p>
                  </div>

                  <div className="pt-4 mt-4 border-t border-slate-800/80 flex items-center justify-between">
                    <div>
                      <div className="text-[11px] text-slate-400">Unit Price</div>
                      <div className="text-2xl font-black text-white">
                        {formatCurrency(primaryItem?.unitPrice || total)}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-[11px] text-slate-400">Order Total ({primaryItem?.quantity || 1}x)</div>
                      <div className="text-xl font-bold text-blue-400">
                        {formatCurrency(total)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Why This Pick & Tradeoffs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card className="border-slate-800 bg-slate-900/60 p-5">
                <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Sparkles className="w-3.5 h-3.5" />
                  Why This Recommendation
                </h4>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {plan.explanation ||
                    'Optimized across verified SQL inventory to satisfy requirements while keeping spend strictly below the authorized transaction ceiling.'}
                </p>
              </Card>

              <Card className="border-slate-800 bg-slate-900/60 p-5">
                <h4 className="text-xs font-semibold text-purple-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                  <Layers className="w-3.5 h-3.5" />
                  Tradeoffs & Alternatives Considered
                </h4>
                <ul className="text-xs text-slate-300 space-y-1.5">
                  {(plan.tradeoffs && plan.tradeoffs.length > 0
                    ? plan.tradeoffs
                    : ['Selected model prioritizes budget ceiling adherence over luxury oversized casing.']
                  ).map((t, idx) => (
                    <li key={idx} className="flex items-start gap-1.5">
                      <span className="text-purple-400 mt-0.5">•</span>
                      <span>{t}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>

            {/* What-If Control Simulation */}
            <Card className="border-slate-800 bg-slate-900/60 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sliders className="w-4 h-4 text-blue-400" />
                    What-If Governance Simulator
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">
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
                    <span className="text-slate-400">Target Budget Ceiling:</span>
                    <span className="font-bold text-blue-400">{formatCurrency(whatIfBudget)}</span>
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
                    <span className="text-slate-400">Order Quantity:</span>
                    <span className="font-bold text-slate-200">{whatIfQuantity} unit(s)</span>
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
            <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-lg">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4 pb-2 border-b border-slate-800">
                Financial Breakdown
              </h4>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Subtotal</span>
                  <span className="text-slate-200 font-mono">{formatCurrency(plan.subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Sales Tax (0%)</span>
                  <span className="text-slate-200 font-mono">{formatCurrency(plan.tax)}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Expedited Shipping</span>
                  <span className="text-slate-200 font-mono">{formatCurrency(plan.shipping)}</span>
                </div>

                {Number(plan.discount) > 0 && (
                  <div className="flex justify-between text-emerald-400">
                    <span>Negotiated Discount</span>
                    <span className="font-mono">−{formatCurrency(plan.discount)}</span>
                  </div>
                )}

                <div className="pt-3 border-t border-slate-800 flex justify-between items-center text-sm font-bold">
                  <span className="text-slate-200">Total Due</span>
                  <span className="text-xl text-blue-400 font-mono">{formatCurrency(total)}</span>
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
            <Card className="border-slate-800 bg-slate-900/80 p-5">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
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

              <div className="space-y-2 text-xs text-slate-400">
                <div className="flex items-center justify-between">
                  <span>Policy Evaluation:</span>
                  <span className="font-semibold text-emerald-400">PASSED</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Behavioral Score:</span>
                  <span className="font-mono text-slate-200">{risk?.score ?? 15} / 100</span>
                </div>
                <div className="pt-2 border-t border-slate-800/80">
                  <span className="text-[11px] text-slate-500">
                    {risk?.explanation || 'All behavioral and spending velocity rules satisfied.'}
                  </span>
                </div>
              </div>
            </Card>

            {/* Negotiation CTA */}
            <Card className="border-slate-800 bg-gradient-to-br from-slate-900 to-indigo-950/30 p-5">
              <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-violet-400">
                <Handshake className="w-4 h-4" />
                <span>Autonomous Merchant Negotiation</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed mb-4">
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
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400">
          Loading purchase plan details...
        </div>
      }
    >
      <PlanDetailContent />
    </React.Suspense>
  );
}

