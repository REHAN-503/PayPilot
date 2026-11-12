'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Send,
  Zap,
  ShoppingBag,
  Package,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Clock,
  Bot,
  CheckCircle2,
  AlertTriangle,
  BarChart3,
  Store,
  Handshake,
  ChevronRight,
  Activity,
  RefreshCw,
  Star,
  Coins,
} from 'lucide-react';
import { DashboardShell } from '../components/layout/DashboardShell';
import { LiveAgentPanel, INITIAL_AGENT_STEPS, type AgentStep } from '../components/agent/LiveAgentPanel';
import { TrustTimeline } from '../components/timeline/TrustTimeline';
import { ApprovalSheet } from '../components/plan/ApprovalSheet';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { DEMO_PROMPTS } from '../lib/schemas';
import type { PurchasePlan, Product } from '../lib/schemas';
import { api } from '../lib/api';
import { formatCurrency, formatDate } from '../lib/utils';
import { useIntentStream, IntentStreamError, type AgentActivity } from '../hooks/useIntentStream';
import { toast } from 'sonner';
import { cn } from '../lib/utils';
import { authClient } from '../lib/auth-client';

/* ============================================================
   QUICK STAT CARD
   ============================================================ */
interface StatCardProps {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  glowClass?: string;
  iconBg?: string;
  delay?: number;
}

function StatCard({ label, value, sub, icon: Icon, trend, trendValue, glowClass, iconBg, delay = 0 }: StatCardProps) {
  return (
    <div
      className={cn('glow-card p-5 desk-enter', glowClass)}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-start justify-between mb-3">
        <div
          className="p-2.5 rounded-[10px] flex items-center justify-center"
          style={{ background: iconBg || 'var(--paper-2)' }}
        >
          <Icon className="w-4 h-4 text-[var(--ink-2)]" />
        </div>
        {trend && trendValue && (
          <span className={cn(
            'inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-[6px]',
            trend === 'up' ? 'text-[var(--verdigris)] bg-[var(--verdigris)]/10' :
            trend === 'down' ? 'text-[var(--vermilion)] bg-[var(--vermilion)]/10' :
            'text-[var(--ink-3)] bg-[var(--paper-2)]',
          )}>
            {trend === 'up' ? <TrendingUp className="w-3 h-3" /> : trend === 'down' ? <TrendingDown className="w-3 h-3" /> : null}
            {trendValue}
          </span>
        )}
      </div>
      <div className="text-lg font-bold tracking-tight text-[var(--ink)] font-mono sm:text-2xl">{value}</div>
      <div className="text-xs text-[var(--ink-3)] mt-1 font-medium">{label}</div>
      {sub && <div className="text-[11px] text-[var(--ink-3)] mt-0.5 opacity-80">{sub}</div>}
    </div>
  );
}

/* ============================================================
   FEATURED PRODUCT CARD
   ============================================================ */
function FeaturedProductCard({ product, onSelect }: { product: Product; onSelect?: (p: Product) => void }) {
  const [imgFailed, setImgFailed] = React.useState(false);

  return (
    <div
      className="product-card group cursor-pointer"
      onClick={() => onSelect?.(product)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onSelect?.(product); }}
    >
      <div className="relative aspect-[4/3] bg-[var(--paper-2)] overflow-hidden">
        {product.imageUrl && !imgFailed ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            unoptimized
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Package className="w-10 h-10 text-[var(--ink-3)]" />
          </div>
        )}
        {/* Overlay badges */}
        <div className="absolute top-2 left-2 flex gap-1.5">
          {product.category && (
            <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[var(--card)]/90 backdrop-blur-sm text-[var(--ink-2)] border border-[var(--rule)]/50">
              {product.category}
            </span>
          )}
        </div>
        {product.stock > 0 && product.stock < 5 && (
          <div className="absolute bottom-2 right-2">
            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[var(--amber)] text-white">
              Only {product.stock} left
            </span>
          </div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <h3 className="font-semibold text-sm text-[var(--ink)] line-clamp-2 group-hover:text-[var(--ledger)] transition-colors">
          {product.name}
        </h3>
        <div className="flex items-center justify-between">
          <span className="text-lg font-black text-[var(--ink)] font-mono">{formatCurrency(product.price)}</span>
          <span className="text-[10px] font-mono text-[var(--ink-3)] bg-[var(--paper-2)] px-2 py-0.5 rounded">
            {product.sku}
          </span>
        </div>
        <div className="flex items-center gap-1.5 pt-1 border-t border-[var(--rule)]/60">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className={cn('w-3 h-3', i < 4 ? 'text-[var(--amber-light)] fill-[var(--amber-light)]' : 'text-[var(--rule)]')} />
          ))}
          <span className="text-[10px] text-[var(--ink-3)] ml-1">{product.stock} in stock</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   RECENT PLAN ROW
   ============================================================ */
function RecentPlanRow({ plan }: { plan: PurchasePlan }) {
  const item = plan.items?.[0];
  const isCompleted = plan.status === 'COMPLETED';
  const isApproved = plan.status === 'APPROVED';
  const isPending = plan.status === 'AWAITING_APPROVAL';
  const isRejected = plan.status === 'REJECTED' || plan.status === 'CANCELLED';

  return (
    <Link
      href={`/plans/${plan.id}`}
      className="flex items-center gap-3 px-4 py-3 rounded-[12px] hover:bg-[var(--paper-2)] transition-colors group border border-transparent hover:border-[var(--rule)]"
    >
      <div className={cn(
        'w-9 h-9 rounded-[10px] flex items-center justify-center shrink-0',
        isCompleted ? 'bg-[var(--verdigris)]/12 text-[var(--verdigris)]' :
        isApproved  ? 'bg-[var(--ledger)]/12 text-[var(--ledger)]' :
        isPending   ? 'bg-[var(--amber)]/12 text-[var(--amber)]' :
        isRejected  ? 'bg-[var(--vermilion)]/12 text-[var(--vermilion)]' :
        'bg-[var(--paper-2)] text-[var(--ink-3)]',
      )}>
        {isCompleted ? <CheckCircle2 className="w-4 h-4" /> :
         isApproved  ? <ShieldCheck className="w-4 h-4" /> :
         isPending   ? <Clock className="w-4 h-4" /> :
         isRejected  ? <AlertTriangle className="w-4 h-4" /> :
         <ShoppingBag className="w-4 h-4" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[var(--ink)] truncate group-hover:text-[var(--ledger)] transition-colors">
          {item?.productName || 'Procurement Order'}
        </div>
        <div className="text-[11px] text-[var(--ink-3)] mt-0.5">{formatDate(plan.createdAt)}</div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-sm font-bold text-[var(--ink)] font-mono">{formatCurrency(plan.total)}</div>
        <span className={cn(
          'text-[10px] font-semibold px-1.5 py-0.5 rounded-full',
          isCompleted ? 'text-[var(--verdigris)]' :
          isApproved  ? 'text-[var(--ledger)]' :
          isPending   ? 'text-[var(--amber)]' :
          isRejected  ? 'text-[var(--vermilion)]' :
          'text-[var(--ink-3)]',
        )}>
          {plan.status.replace('_', ' ')}
        </span>
      </div>
      <ChevronRight className="w-4 h-4 text-[var(--ink-3)] opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </Link>
  );
}

/* ============================================================
   QUICK ACTION CARDS
   ============================================================ */
function QuickActions() {
  const actions = [
    { label: 'Browse Store', desc: 'Live product feed', href: '/store', icon: Store, color: 'var(--ledger)', bg: 'var(--ledger)' },
    { label: 'AI Assistant', desc: 'Chat & automate', href: '/chat', icon: Bot, color: 'var(--purple)', bg: 'var(--purple)' },
    { label: 'Negotiate', desc: 'Get a better price', href: '/negotiation', icon: Handshake, color: 'var(--brass)', bg: 'var(--brass)' },
    { label: 'Analytics', desc: 'Spend insights', href: '/analytics', icon: BarChart3, color: 'var(--verdigris)', bg: 'var(--verdigris)' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map((a, i) => (
        <Link
          key={a.href}
          href={a.href}
          className="glow-card p-4 flex flex-col gap-3 group hover:scale-[1.02] transition-transform desk-enter"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div
            className="w-10 h-10 rounded-[12px] flex items-center justify-center transition-transform group-hover:scale-110"
            style={{ background: `${a.bg}/15`, color: a.color }}
          >
            <a.icon className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[var(--ink)] group-hover:text-[var(--ledger)] transition-colors">{a.label}</div>
            <div className="text-[11px] text-[var(--ink-3)]">{a.desc}</div>
          </div>
          <ChevronRight className="w-3.5 h-3.5 text-[var(--ink-3)] opacity-0 group-hover:opacity-100 transition-opacity mt-auto" />
        </Link>
      ))}
    </div>
  );
}

/* ============================================================
   MAIN DASHBOARD PAGE
   ============================================================ */
export default function DashboardPage() {
  const [goal, setGoal] = React.useState(DEMO_PROMPTS[0]?.text ?? '');
  const [isPlanning, setIsPlanning] = React.useState(false);
  const [steps, setSteps] = React.useState<AgentStep[]>(INITIAL_AGENT_STEPS);
  const [currentStepId, setCurrentStepId] = React.useState<string | undefined>();
  const [activePlan, setActivePlan] = React.useState<PurchasePlan | null>(null);
  const [approvalSheetOpen, setApprovalSheetOpen] = React.useState(false);
  const [degradedMode, setDegradedMode] = React.useState(false);
  const [showAgentPanel, setShowAgentPanel] = React.useState(false);
  const [selectedProduct, setSelectedProduct] = React.useState<Product | null>(null);
  const router = useRouter();
  const { stream, isStreaming } = useIntentStream();
  const { data: session } = authClient.useSession();
  const dashboardStorageKey = session?.user?.email ? `paypilot-dashboard:${session.user.email.toLowerCase()}` : null;
  const [restoredDashboardKey, setRestoredDashboardKey] = React.useState<string | null>(null);

  const greeting = React.useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, []);

  const firstName = session?.user?.name?.split(' ')[0] || 'there';

  React.useEffect(() => {
    if (!dashboardStorageKey) return;
    try {
      const saved = sessionStorage.getItem(dashboardStorageKey);
      if (saved) {
        const state = JSON.parse(saved) as {
          goal?: string; steps?: Array<{ id?: string; status?: string; detail?: string }>; currentStepId?: string;
          activePlan?: PurchasePlan | null; degradedMode?: boolean; showAgentPanel?: boolean;
        };
        if (typeof state.goal === 'string') setGoal(state.goal);
        if (Array.isArray(state.steps)) {
          // Restore serializable step state onto the current icon components. Lucide
          // icons are React component objects and cannot be round-tripped through JSON.
          const savedSteps = new Map(state.steps.map((step) => [step.id, step]));
          setSteps(INITIAL_AGENT_STEPS.map((step) => {
            const savedStep = savedSteps.get(step.id);
            const validStatus = ['idle', 'running', 'completed', 'blocked'].includes(savedStep?.status || '');
            return {
              ...step,
              status: validStatus ? savedStep!.status as AgentStep['status'] : step.status,
              detail: typeof savedStep?.detail === 'string' ? savedStep.detail : undefined,
            };
          }));
        }
        if (typeof state.currentStepId === 'string') setCurrentStepId(state.currentStepId);
        if (state.activePlan) setActivePlan(state.activePlan);
        if (typeof state.degradedMode === 'boolean') setDegradedMode(state.degradedMode);
        if (typeof state.showAgentPanel === 'boolean') setShowAgentPanel(state.showAgentPanel);
      }
    } catch {
      sessionStorage.removeItem(dashboardStorageKey);
    }
    setRestoredDashboardKey(dashboardStorageKey);
  }, [dashboardStorageKey]);

  React.useEffect(() => {
    if (!dashboardStorageKey || restoredDashboardKey !== dashboardStorageKey) return;
    try {
      sessionStorage.setItem(dashboardStorageKey, JSON.stringify({
        goal,
        steps: steps.map(({ id, status, detail }) => ({ id, status, detail })),
        currentStepId,
        activePlan,
        degradedMode,
        showAgentPanel,
      }));
    } catch {
      // Keep dashboard interactions available if browser storage is unavailable.
    }
  }, [dashboardStorageKey, restoredDashboardKey, goal, steps, currentStepId, activePlan, degradedMode, showAgentPanel]);

  // Queries
  const { data: plans, refetch: refetchPlans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => api.getPlans(),
  });

  const { data: policyData } = useQuery({
    queryKey: ['policy'],
    queryFn: () => api.getPolicy(),
  });

  const { data: analyticsSummary } = useQuery({
    queryKey: ['analytics-summary'],
    queryFn: () => api.getAnalyticsSummary(),
  });

  const { data: timelineData, refetch: refetchTimeline } = useQuery({
    queryKey: ['timeline-recent'],
    queryFn: () => api.getTimeline(),
  });

  const { data: catalog } = useQuery({
    queryKey: ['products-featured'],
    queryFn: () => api.getProducts({ limit: 6 }),
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
      setShowAgentPanel(true);
      setActivePlan(null);
      setSteps(
        INITIAL_AGENT_STEPS.map((s, idx) => ({
          ...s,
          status: idx === 0 ? 'running' : 'idle',
          detail: undefined,
        })),
      );
      setCurrentStepId('parse');
      toast.loading('AI Agent planning your purchase...', { id: 'plan-progress' });
      setDegradedMode(false);

      try {
        await stream(textToPlan, {
          onActivity: applyActivity,
          onResult: (res) => {
            if (res.policyEvaluation?.decision === 'BLOCK' && (!res.plan || res.plan.status === 'REJECTED')) {
              updateStepStatus('policy', 'blocked', res.policyEvaluation.violations?.[0] || 'Budget exceeded');
              return;
            }
            updateStepStatus('ready', 'completed', 'Plan ready for authorization');
            toast.success('Purchase plan ready!', { id: 'plan-progress' });
            if (res.plan?.id) {
              router.push(`/plans/${res.plan.id}`);
            }
          },
          onError: () => undefined,
        });
      } catch (streamError) {
        if (streamError instanceof IntentStreamError && streamError.requestStarted) throw streamError;
        setDegradedMode(true);
        toast.info('Using standard planning...', { id: 'plan-progress' });
        const res = await api.createIntent(textToPlan);
        if (res.policyEvaluation?.decision === 'BLOCK' && (!res.plan || res.plan.status === 'REJECTED')) {
          updateStepStatus('policy', 'blocked', res.policyEvaluation.violations?.[0] || 'Budget exceeded');
        } else if (res.plan) {
          updateStepStatus('ready', 'completed', 'Plan ready for authorization');
          setActivePlan(res.plan);
          router.push(`/plans/${res.plan.id}`);
        }
      }

      await refetchPlans();
      await refetchTimeline();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Planning failed', { id: 'plan-progress', description: message });
      updateStepStatus('parse', 'blocked', message);
    } finally {
      setIsPlanning(false);
    }
  };

  // Prefill goal when user clicks a product
  const handleProductSelect = (product: Product) => {
    setSelectedProduct(product);
    setGoal(`I need a ${product.name} — budget up to ${formatCurrency(Number(product.price) * 1.1)}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const latestPlan = activePlan || plans?.[0];
  const policy = policyData?.policy;
  const metrics = policyData?.spendMetrics;
  const recentPlans = plans?.slice(0, 5) ?? [];

  const dailySpent = metrics?.dailySpent ?? 0;
  const dailyLimit = policy?.dailySpendingLimit ? Number(policy.dailySpendingLimit) : 1000;
  const dailyRemaining = metrics?.dailyRemaining ?? dailyLimit;
  const dailyPct = dailyLimit > 0 ? Math.min(100, Math.round((dailySpent / dailyLimit) * 100)) : 0;

  return (
    <DashboardShell>
      <div className="space-y-8">

        {/* ── Hero greeting ── */}
        <div className="desk-enter">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-[var(--ink)]">
                {greeting}, <span className="gradient-text">{firstName}</span> 👋
              </h1>
              <p className="text-sm text-[var(--ink-3)] mt-1">
                Your AI-powered procurement dashboard. Describe what you need and let PayPilot handle the rest.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link href="/store">
                <Button variant="outline" size="sm" className="gap-2">
                  <Store className="w-4 h-4" />
                  <span className="hidden sm:inline">Browse Store</span>
                </Button>
              </Link>
              <Link href="/chat">
                <Button variant="glow" size="sm" className="gap-2">
                  <Bot className="w-4 h-4" />
                  <span className="hidden sm:inline">AI Chat</span>
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* ── KPI Stats Row ── */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          <StatCard
            label="Total Spend"
            value={formatCurrency(analyticsSummary?.totalSpend ?? 0)}
            sub="All captured transactions"
            icon={DollarSign}
            trend="up"
            trendValue="+12%"
            glowClass="stat-glow-blue"
            iconBg="rgba(52,73,232,0.12)"
            delay={0}
          />
          <StatCard
            label="Daily Remaining"
            value={formatCurrency(dailyRemaining)}
            sub={`${dailyPct}% of ${formatCurrency(dailyLimit)} used`}
            icon={Coins}
            trend="neutral"
            trendValue={`${100 - dailyPct}% left`}
            glowClass="stat-glow-green"
            iconBg="rgba(15,122,82,0.12)"
            delay={60}
          />
          <StatCard
            label="Purchase Plans"
            value={String(plans?.length ?? 0)}
            sub={`${plans?.filter(p => p.status === 'AWAITING_APPROVAL').length ?? 0} awaiting approval`}
            icon={ShoppingBag}
            trend="neutral"
            trendValue="active"
            glowClass="stat-glow-amber"
            iconBg="rgba(194,124,26,0.12)"
            delay={120}
          />
          <StatCard
            label="Success Rate"
            value={`${analyticsSummary?.successRate ?? 100}%`}
            sub={`${analyticsSummary?.webhookConfirmedCount ?? 0} webhook confirmed`}
            icon={CheckCircle2}
            trend="up"
            trendValue="Excellent"
            glowClass="stat-glow-purple"
            iconBg="rgba(124,58,237,0.12)"
            delay={180}
          />
        </div>

        {/* ── AI Intent Input + Agent Panel ── */}
        <div className="desk-enter desk-enter-delay-2 grid grid-cols-1 xl:grid-cols-12 gap-6">

          {/* Left: Intent input + product grid */}
          <div className="xl:col-span-7 space-y-6">

            {/* AI Intent Box */}
            <div className="glow-card p-1.5 relative overflow-hidden">
              {/* Gradient top line */}
              <div className="absolute top-0 left-0 right-0 h-0.5 rounded-t-[14px]"
                style={{ background: 'linear-gradient(90deg, var(--ledger), var(--purple), var(--cyan))' }}
              />
              <div className="p-4 pb-3">
                <div className="flex items-center gap-2.5 mb-3">
                  <div className="w-7 h-7 rounded-[8px] flex items-center justify-center"
                    style={{ background: 'linear-gradient(135deg, var(--ledger) 0%, var(--purple) 100%)' }}>
                    <Sparkles className="w-3.5 h-3.5 text-white" />
                  </div>
                  <div>
                    <span className="text-sm font-bold text-[var(--ink)]">AI Purchase Planner</span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="live-dot" />
                      <span className="text-[10px] text-[var(--verdigris)] font-semibold">Live · Agent v2.0</span>
                    </div>
                  </div>
                  <Badge variant="outline" className="ml-auto text-[10px]">
                    PayPal Sandbox
                  </Badge>
                </div>

                <Textarea
                  value={goal}
                  onChange={(e) => setGoal(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                      void handlePlanSubmit(goal);
                    }
                  }}
                  placeholder="Describe what you need — e.g. 'I need a developer monitor under $250. Fast shipping preferred.'"
                  className="text-base min-h-[90px] border-none bg-[var(--paper-2)]/60 focus-visible:ring-0 p-4 rounded-[10px] text-[var(--ink)] placeholder:text-[var(--ink-3)] resize-none"
                />
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 border-t border-[var(--rule)]/60">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                  <span className="text-[11px] font-semibold text-[var(--ink-3)] shrink-0">Examples:</span>
                  {DEMO_PROMPTS.slice(0, 4).map((prompt) => (
                    <button
                      key={prompt.id}
                      onClick={() => { setGoal(prompt.text); void handlePlanSubmit(prompt.text); }}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-[var(--rule)] bg-[var(--paper-2)] hover:bg-[var(--ledger)]/10 hover:border-[var(--ledger)]/40 hover:text-[var(--ledger)] text-[var(--ink-2)] transition-all cursor-pointer"
                    >
                      <span className="text-[var(--ledger)] font-mono text-[10px]">{prompt.tag}</span>
                      {prompt.label}
                    </button>
                  ))}
                </div>
                <Button
                  variant="glow"
                  size="lg"
                  onClick={() => void handlePlanSubmit(goal)}
                  disabled={isPlanning || isStreaming}
                  className="shrink-0 h-11 px-6 font-bold rounded-[10px] gap-2"
                  style={{ background: isPlanning ? undefined : 'linear-gradient(135deg, var(--ledger) 0%, var(--brass) 100%)' }}
                >
                  {isPlanning ? (
                    <><Zap className="w-4 h-4 animate-spin" /> Planning...</>
                  ) : (
                    <><Send className="w-4 h-4" /> Create Plan</>
                  )}
                </Button>
              </div>
            </div>

            {/* Daily Budget Visual */}
            <div className="glow-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-[var(--ledger)]" />
                  <span className="text-sm font-semibold text-[var(--ink)]">Daily Spend Progress</span>
                </div>
                <Link href="/policy" className="text-[11px] text-[var(--ledger)] hover:underline font-medium">
                  Edit limits →
                </Link>
              </div>
              <div className="mb-2 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                <span className="text-xs text-[var(--ink-3)]">
                  {formatCurrency(dailySpent)} spent
                </span>
                <span className="text-xs font-semibold text-[var(--ink)] sm:text-right">
                  {formatCurrency(dailyRemaining)} left of {formatCurrency(dailyLimit)}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[var(--paper-2)] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${dailyPct}%`,
                    background: dailyPct > 80
                      ? 'linear-gradient(90deg, var(--amber), var(--vermilion))'
                      : 'linear-gradient(90deg, var(--ledger), var(--purple))',
                  }}
                />
              </div>
              <div className="flex items-center justify-between mt-2">
                <span className="text-[10px] text-[var(--ink-3)]">0</span>
                <span className="text-[10px] font-semibold text-[var(--ink-3)]">{dailyPct}% used</span>
                <span className="text-[10px] text-[var(--ink-3)]">{formatCurrency(dailyLimit)}</span>
              </div>
            </div>

            {/* Featured Products */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Store className="w-4 h-4 text-[var(--ledger)]" />
                  <h2 className="text-sm font-bold text-[var(--ink)]">Featured Products</h2>
                  <span className="flex items-center gap-1 text-[10px] text-[var(--verdigris)] font-semibold">
                    <span className="live-dot" />
                    Live catalog
                  </span>
                </div>
                <Link href="/store" className="text-[11px] text-[var(--ledger)] hover:underline font-medium flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              {catalog?.data && catalog.data.length > 0 ? (
                <div className="grid grid-cols-1 gap-3 min-[440px]:grid-cols-2 sm:grid-cols-3">
                  {catalog.data.slice(0, 6).map((product) => (
                    <FeaturedProductCard
                      key={product.id}
                      product={product}
                      onSelect={handleProductSelect}
                    />
                  ))}
                </div>
              ) : (
                <div className="glow-card p-8 text-center">
                  <Package className="w-8 h-8 text-[var(--ink-3)] mx-auto mb-2" />
                  <p className="text-sm text-[var(--ink-3)]">Loading live catalog...</p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Agent panel + recent plans + timeline */}
          <div className="xl:col-span-5 space-y-6">

            {/* Quick Actions */}
            <QuickActions />

            {/* Agent stepper */}
            {showAgentPanel && (
              <div className="scale-in">
                {degradedMode && (
                  <p className="text-[11px] text-[var(--amber)] mb-2 flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Degraded mode — streaming unavailable
                  </p>
                )}
                <LiveAgentPanel steps={steps} currentStepId={currentStepId} />
              </div>
            )}

            {/* Latest Plan Preview */}
            {latestPlan && (
              <div className="glow-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--rule)] bg-[var(--paper-2)]/40">
                  <div className="flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-[var(--ledger)]" />
                    <span className="text-sm font-bold text-[var(--ink)]">Latest Plan</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        latestPlan.status === 'APPROVED' || latestPlan.status === 'COMPLETED' ? 'success' :
                        latestPlan.status === 'AWAITING_APPROVAL' ? 'warning' : 'secondary'
                      }
                    >
                      {latestPlan.status.replace('_', ' ')}
                    </Badge>
                    <span className="text-[10px] text-[var(--ink-3)] font-mono">v{latestPlan.version}</span>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-sm text-[var(--ink)] truncate">
                        {latestPlan.items?.[0]?.productName || 'Procurement Package'}
                      </h3>
                      <p className="text-[11px] text-[var(--ink-3)] mt-1 line-clamp-2">
                        {latestPlan.explanation || 'AI-generated purchase plan'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xl font-black text-[var(--ink)] font-mono">
                        {formatCurrency(latestPlan.total)}
                      </div>
                      <div className="text-[10px] text-[var(--ink-3)]">USD</div>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {latestPlan.status === 'AWAITING_APPROVAL' && (
                      <Button
                        variant="glow"
                        size="sm"
                        className="flex-1 text-xs"
                        onClick={() => setApprovalSheetOpen(true)}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Authorize & Pay
                      </Button>
                    )}
                    <Link href={`/plans/${latestPlan.id}`} className="min-w-0 flex-1">
                      <Button variant="outline" size="sm" className="w-full text-xs">
                        View Details <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    </Link>
                    {latestPlan.status === 'AWAITING_APPROVAL' && (
                      <Link href={`/negotiation?planId=${latestPlan.id}`}>
                        <Button variant="outline" size="sm" className="text-xs gap-1.5">
                          <Handshake className="w-3.5 h-3.5" /> Negotiate
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Recent Plans */}
            {recentPlans.length > 0 && (
              <div className="glow-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--rule)] bg-[var(--paper-2)]/40">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-[var(--ink-3)]" />
                    <span className="text-sm font-bold text-[var(--ink)]">Recent Plans</span>
                  </div>
                  <Link href="/plans" className="text-[11px] text-[var(--ledger)] hover:underline font-medium">
                    View all
                  </Link>
                </div>
                <div className="p-2">
                  {recentPlans.map((plan) => (
                    <RecentPlanRow key={plan.id} plan={plan} />
                  ))}
                </div>
              </div>
            )}

            {/* Trust Timeline Preview */}
            {timelineData && timelineData.events.length > 0 && (
              <div className="glow-card overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--rule)] bg-[var(--paper-2)]/40">
                  <div className="flex items-center gap-2">
                    <Activity className="w-4 h-4 text-[var(--ledger)]" />
                    <span className="text-sm font-bold text-[var(--ink)]">Audit Trail</span>
                    <span className="live-dot" />
                  </div>
                  <Link href="/timeline" className="text-[11px] text-[var(--ledger)] hover:underline font-medium">
                    Full timeline
                  </Link>
                </div>
                <div className="p-4 max-h-64 overflow-y-auto">
                  <TrustTimeline
                    events={timelineData.events.slice(0, 6)}
                    compact
                  />
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ApprovalSheet */}
        {latestPlan && approvalSheetOpen && (
          <ApprovalSheet
            open={approvalSheetOpen}
            onOpenChange={setApprovalSheetOpen}
            plan={latestPlan}
            onPlanUpdated={(updated) => {
              setActivePlan(updated);
              void refetchPlans();
            }}
          />
        )}

      </div>
    </DashboardShell>
  );
}
