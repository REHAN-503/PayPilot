'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShieldCheck,
  CheckCircle2,
  Lock,
  Handshake,
  Info,
  Sparkles,
  Save,
  Tag,
} from 'lucide-react';
import { DashboardShell } from '../../components/layout/DashboardShell';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Switch } from '../../components/ui/switch';
import { Badge } from '../../components/ui/badge';
import { Skeleton } from '../../components/ui/progress';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import type { AutonomyMode, UserPolicy } from '../../lib/schemas';
import { toast } from 'sonner';

const ALL_CATEGORIES = ['Electronics', 'Accessories', 'Work', 'Home', 'Lifestyle'];

export default function PolicyCenterPage() {
  const queryClient = useQueryClient();

  const { data: policyData, isLoading } = useQuery({
    queryKey: ['policy'],
    queryFn: () => api.getPolicy(),
  });

  const [autonomyMode, setAutonomyMode] = React.useState<AutonomyMode>('ASK_EVERY_TIME');
  const [maxTx, setMaxTx] = React.useState<string>('500');
  const [dailyLimit, setDailyLimit] = React.useState<string>('1000');
  const [monthlyLimit, setMonthlyLimit] = React.useState<string>('5000');
  const [requireApprovalAbove, setRequireApprovalAbove] = React.useState<string>('150');
  const [allowAutoExecute, setAllowAutoExecute] = React.useState(false);
  const [allowNegotiation, setAllowNegotiation] = React.useState(true);
  const [negotiationRounds, setNegotiationRounds] = React.useState<number>(3);
  const [autoApproveCats, setAutoApproveCats] = React.useState<string[]>(['Electronics']);
  const [syncedPolicyId, setSyncedPolicyId] = React.useState<string | null>(null);
  const [agentPaused, setAgentPaused] = React.useState(false);
  const [simulation, setSimulation] = React.useState({ category: 'Electronics', amount: '50', merchant: 'Demo merchant' });
  const [simulationResult, setSimulationResult] = React.useState<{ decision: string; reasons: string[] } | null>(null);

  if (policyData?.policy && syncedPolicyId !== (policyData.policy.id || 'loaded')) {
    setSyncedPolicyId(policyData.policy.id || 'loaded');
    const p = policyData.policy;
    setAutonomyMode(p.autonomyMode || 'ASK_EVERY_TIME');
    setMaxTx(p.maxTransactionAmount != null ? String(p.maxTransactionAmount) : '500');
    setDailyLimit(p.dailySpendingLimit != null ? String(p.dailySpendingLimit) : '1000');
    setMonthlyLimit(p.monthlySpendingLimit != null ? String(p.monthlySpendingLimit) : '5000');
    setRequireApprovalAbove(p.requireApprovalAbove != null ? String(p.requireApprovalAbove) : '150');
    setAllowAutoExecute(p.allowAutoExecute ?? false);
    setAllowNegotiation(p.allowNegotiation ?? true);
    setNegotiationRounds(p.negotiationMaxRounds ?? 3);
    setAutoApproveCats(p.autoApproveCategories || ['Electronics']);
    setAgentPaused(p.agentPaused ?? false);
  }

  const updateMutation = useMutation({
    mutationFn: (newPolicy: Partial<UserPolicy>) => api.updatePolicy(newPolicy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['policy'] });
      toast.success('Governance Policy Updated', {
        description: 'New deterministic spending boundaries are now enforced across all agents.',
      });
    },
    onError: (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Policy Update Failed', { description: message });
    },
  });

  const handleSave = () => {
    updateMutation.mutate({
      autonomyMode,
      maxTransactionAmount: maxTx ? parseFloat(maxTx) : null,
      dailySpendingLimit: dailyLimit ? parseFloat(dailyLimit) : null,
      monthlySpendingLimit: monthlyLimit ? parseFloat(monthlyLimit) : null,
      requireApprovalAbove: requireApprovalAbove ? parseFloat(requireApprovalAbove) : null,
      allowAutoExecute,
      allowNegotiation,
      negotiationMaxRounds: negotiationRounds,
      autoApproveCategories: autoApproveCats,
      agentPaused,
    });
  };

  const toggleCategory = (cat: string) => {
    setAutoApproveCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </DashboardShell>
    );
  }

  return (
    <DashboardShell>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black text-[var(--ink)] tracking-tight flex items-center gap-2.5">
              <ShieldCheck className="w-6 h-6 text-[var(--ledger)]" />
              Policy Center & Governance Engine
            </h1>
            <p className="text-xs sm:text-sm text-[var(--ink-3)] mt-1">
              Configure deterministic limits, autonomy permissions, and autonomous negotiation rounds.
            </p>
          </div>

          <Card className="border-[var(--amber)] p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-bold text-[var(--ink)]">Agent kill-switch</h2>
                <p className="text-xs text-[var(--ink-3)]">Pause approval and payment actions immediately.</p>
              </div>
              <Switch checked={agentPaused} onCheckedChange={(checked) => {
                if (checked && !window.confirm('Pause all agent approval and payment actions?')) return;
                setAgentPaused(checked);
                updateMutation.mutate({ agentPaused: checked });
              }} />
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="font-bold text-[var(--ink)]">Test my rules</h2>
            <p className="mb-4 text-xs text-[var(--ink-3)]">Simulate a purchase without creating a plan or payment.</p>
            <div className="grid gap-3 sm:grid-cols-3">
              <Input value={simulation.category} onChange={(event) => setSimulation({ ...simulation, category: event.target.value })} placeholder="Category" />
              <Input value={simulation.amount} onChange={(event) => setSimulation({ ...simulation, amount: event.target.value })} placeholder="Amount" type="number" />
              <Input value={simulation.merchant} onChange={(event) => setSimulation({ ...simulation, merchant: event.target.value })} placeholder="Merchant" />
            </div>
            <Button className="mt-3" variant="outline" onClick={async () => {
              const result = await api.simulatePolicy({ ...simulation, amount: Number(simulation.amount) });
              setSimulationResult({ decision: result.decision, reasons: [...result.violations, ...result.reasons] });
            }}>Run simulation</Button>
            {simulationResult && <div className="mt-3 text-sm text-[var(--ink)]"><strong>{simulationResult.decision}</strong>{simulationResult.reasons.length > 0 && <ul className="mt-1 list-disc pl-5 text-xs text-[var(--ink-3)]">{simulationResult.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}</div>}
          </Card>

          <Button
            variant="glow"
            onClick={handleSave}
            disabled={updateMutation.isPending}
            className="font-semibold  "
          >
            <Save className="w-4 h-4 mr-2" />
            {updateMutation.isPending ? 'Saving Policy...' : 'Save Policy'}
          </Button>
        </div>

        {/* 1. Autonomy Mode Selector Cards */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)]">
            1. Autonomy & Authorization Level
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Card 1: Ask Every Time */}
            <div
              onClick={() => setAutonomyMode('ASK_EVERY_TIME')}
              className={`p-5 rounded-[var(--radius)] border transition-all cursor-pointer flex flex-col justify-between ${
                autonomyMode === 'ASK_EVERY_TIME'
                  ? 'bg-[var(--paper-2)] border-[var(--amber)]  shadow-amber-900/10'
                  : 'bg-[var(--card)] border-[var(--rule)] hover:border-[var(--rule)]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-[var(--ink)]">Ask Every Time</span>
                  {autonomyMode === 'ASK_EVERY_TIME' && (
                    <Badge variant="warning">Active</Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--ink-3)] leading-relaxed">
                  Every single transaction requires manual user authorization before PayPal checkout orders can be funded.
                </p>
              </div>
              <div className="text-[11px] font-mono text-[var(--amber)] mt-4 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Zero Autonomous Capture</span>
              </div>
            </div>

            {/* Card 2: Auto Within Limits */}
            <div
              onClick={() => setAutonomyMode('AUTO_WITHIN_LIMITS')}
              className={`p-5 rounded-[var(--radius)] border transition-all cursor-pointer flex flex-col justify-between ${
                autonomyMode === 'AUTO_WITHIN_LIMITS'
                  ? 'bg-[var(--paper-2)] border-[var(--ledger)]  '
                  : 'bg-[var(--card)] border-[var(--rule)] hover:border-[var(--rule)]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-[var(--ink)]">Auto-Execute Within Limits</span>
                  {autonomyMode === 'AUTO_WITHIN_LIMITS' && (
                    <Badge variant="default">Active</Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--ink-3)] leading-relaxed">
                  Agent automatically executes orders if total ≤ approval ceiling, risk is low, and category is whitelisted.
                </p>
              </div>
              <div className="text-[11px] font-mono text-[var(--ledger)] mt-4 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Autonomous Bounded Execution</span>
              </div>
            </div>

            {/* Card 3: Manual Approval */}
            <div
              onClick={() => setAutonomyMode('MANUAL_APPROVAL')}
              className={`p-5 rounded-[var(--radius)] border transition-all cursor-pointer flex flex-col justify-between ${
                autonomyMode === 'MANUAL_APPROVAL'
                  ? 'bg-[var(--paper-2)] border-[var(--rule)] '
                  : 'bg-[var(--card)] border-[var(--rule)] hover:border-[var(--rule)]'
              }`}
            >
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm text-[var(--ink)]">Strict Corporate Oversight</span>
                  {autonomyMode === 'MANUAL_APPROVAL' && (
                    <Badge variant="secondary">Active</Badge>
                  )}
                </div>
                <p className="text-xs text-[var(--ink-3)] leading-relaxed">
                  Dual-signoff mode. All budget adjustments, swaps, and replans require explicit administrative review.
                </p>
              </div>
              <div className="text-[11px] font-mono text-[var(--ink-3)] mt-4 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                <span>Enterprise Dual Control</span>
              </div>
            </div>
          </div>
        </div>

        {/* 2. Spending Limits Grid */}
        <div className="space-y-3">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)]">
            2. Deterministic Hard Spending Ceilings
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border-[var(--rule)] bg-[var(--card)]/70 p-4">
              <label className="text-xs font-medium text-[var(--ink-2)] block mb-1.5">
                Max Per Transaction ($)
              </label>
              <Input
                type="number"
                value={maxTx}
                onChange={(e) => setMaxTx(e.target.value)}
                placeholder="500"
                className="font-mono text-base font-bold text-[var(--ledger)]"
              />
              <span className="text-[11px] text-[var(--ink-3)] mt-1 block">Hard stop ceiling</span>
            </Card>

            <Card className="border-[var(--rule)] bg-[var(--card)]/70 p-4">
              <label className="text-xs font-medium text-[var(--ink-2)] block mb-1.5">
                Daily Spending Limit ($)
              </label>
              <Input
                type="number"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
                placeholder="1000"
                className="font-mono text-base font-bold text-[var(--ledger)]"
              />
              <span className="text-[11px] text-[var(--ink-3)] mt-1 block">Cumulative captured funds</span>
            </Card>

            <Card className="border-[var(--rule)] bg-[var(--card)]/70 p-4">
              <label className="text-xs font-medium text-[var(--ink-2)] block mb-1.5">
                Monthly Spending Limit ($)
              </label>
              <Input
                type="number"
                value={monthlyLimit}
                onChange={(e) => setMonthlyLimit(e.target.value)}
                placeholder="5000"
                className="font-mono text-base font-bold text-[var(--ledger)]"
              />
              <span className="text-[11px] text-[var(--ink-3)] mt-1 block">Monthly budget quota</span>
            </Card>

            <Card className="border-[var(--rule)] bg-[var(--card)]/70 p-4">
              <label className="text-xs font-medium text-[var(--ink-2)] block mb-1.5">
                Require Approval Above ($)
              </label>
              <Input
                type="number"
                value={requireApprovalAbove}
                onChange={(e) => setRequireApprovalAbove(e.target.value)}
                placeholder="150"
                className="font-mono text-base font-bold text-[var(--ledger)]"
              />
              <span className="text-[11px] text-[var(--ink-3)] mt-1 block">In auto-execute mode</span>
            </Card>
          </div>
        </div>

        {/* 3. Category Whitelist & Autonomous Negotiation */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Categories */}
          <Card className="border-[var(--rule)] bg-[var(--card)]/70 p-5 space-y-4">
            <div>
              <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                <Tag className="w-4 h-4 text-[var(--ledger)]" />
                Auto-Approve Categories
              </h3>
              <p className="text-xs text-[var(--ink-3)] mt-0.5">
                Categories permitted for autonomous auto-approval when under limit threshold.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-1">
              {ALL_CATEGORIES.map((cat) => {
                const isSelected = autoApproveCats.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1.5 rounded-[var(--radius)] text-xs font-medium border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--ledger)]/20 text-[var(--ledger)] border-[var(--ledger)]/50 shadow-sm'
                        : 'bg-[var(--paper)] text-[var(--ink-3)] border-[var(--rule)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}
                    {cat}
                  </button>
                );
              })}
            </div>
          </Card>

          {/* Negotiation Settings */}
          <Card className="border-[var(--rule)] bg-[var(--card)]/70 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-[var(--ink)] flex items-center gap-2">
                  <Handshake className="w-4 h-4 text-[var(--brass)]" />
                  Autonomous Merchant Negotiation
                </h3>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">
                  Allow buyer agent to counter-offer merchant bot for commercial discounts.
                </p>
              </div>
              <Switch checked={allowNegotiation} onCheckedChange={setAllowNegotiation} />
            </div>

            {allowNegotiation && (
              <div className="pt-3 border-t border-[var(--rule)] flex items-center justify-between">
                <div>
                  <span className="text-xs font-medium text-[var(--ink)]">Max Negotiation Rounds</span>
                  <p className="text-[11px] text-[var(--ink-3)]">Bounded bargaining loop (1-5 rounds)</p>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={5}
                  value={negotiationRounds}
                  onChange={(e) => setNegotiationRounds(parseInt(e.target.value) || 3)}
                  className="w-20 font-mono text-center"
                />
              </div>
            )}
          </Card>
        </div>

        {/* 4. Live "What This Means" Preview Box */}
        <div className="p-5 rounded-3xl bg-[var(--paper-2)] border border-[var(--ledger)] text-xs text-[var(--ledger)] space-y-2">
          <div className="font-bold text-[var(--ledger)] flex items-center gap-2 text-sm">
            <Info className="w-4 h-4" />
            Live Governance Interpretation
          </div>
          <p className="leading-relaxed">
            Under this configuration:{' '}
            <strong className="text-[var(--ink)]">
              {autonomyMode === 'ASK_EVERY_TIME'
                ? 'Every purchase proposal will prompt for explicit human confirmation.'
                : `Transactions up to ${formatCurrency(requireApprovalAbove)} in [${autoApproveCats.join(', ')}] will auto-execute without friction.`}
            </strong>{' '}
            Any single order exceeding <strong className="text-[var(--ink)]">{formatCurrency(maxTx)}</strong> or pushing daily spend beyond{' '}
            <strong className="text-[var(--ink)]">{formatCurrency(dailyLimit)}</strong> is immediately blocked by hard deterministic code guard.
            {allowNegotiation ? ` Autonomous price bargaining is enabled up to ${negotiationRounds} rounds.` : ' Price negotiation is disabled.'}
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
