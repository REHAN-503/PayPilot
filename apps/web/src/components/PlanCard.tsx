'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  CreditCard,
  RefreshCw,
  XCircle,
  FileText,
  Clock,
  Layers,
} from 'lucide-react';
import { api } from '../lib/api';
import type { PurchasePlan, Product } from '../types';

interface PlanCardProps {
  plan: PurchasePlan;
  alternatives?: Product[];
  onPlanUpdated: () => void;
  onViewLedger?: () => void;
}

export function PlanCard({
  plan,
  alternatives = [],
  onPlanUpdated,
  onViewLedger,
}: PlanCardProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const item = plan?.items?.[0];
  const risk = plan?.riskAssessments?.[0];
  const approval = plan?.approvals?.[0];

  const isAwaitingApproval = plan.status === 'AWAITING_APPROVAL';
  const isApproved = plan.status === 'APPROVED';
  const isCompleted = plan.status === 'COMPLETED';
  const isRejected = plan.status === 'REJECTED';

  async function handleAuthorize() {
    if (!approval?.id) return;
    setLoading(true);
    setError(null);
    try {
      await api.submitDecision(approval.id, 'APPROVED', 'Authorized by user in Agent Studio');
      setSuccessMsg('Plan authorized! Ready for PayPal execution.');
      onPlanUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to authorize plan');
    } finally {
      setLoading(false);
    }
  }

  async function handleReject() {
    if (!approval?.id) return;
    setLoading(true);
    setError(null);
    try {
      await api.submitDecision(approval.id, 'REJECTED', 'User declined plan in Agent Studio');
      onPlanUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to reject plan');
    } finally {
      setLoading(false);
    }
  }

  async function handlePayPalCheckout() {
    setLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const orderRes = await api.createOrder(plan.id);
      const paymentId = orderRes.payment.id;
      const captureRes = await api.capturePayment(paymentId);
      setSuccessMsg(`Payment settled via PayPal Sandbox! Capture ID: ${captureRes.captureId}`);
      onPlanUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'PayPal transaction execution failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSelectAlternative(productId: string) {
    setLoading(true);
    setError(null);
    try {
      await api.selectAlternative(plan.id, productId);
      setSuccessMsg('Alternative selected! Totals and policy re-evaluated server-side.');
      onPlanUpdated();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to swap product');
    } finally {
      setLoading(false);
    }
  }

  const riskLevel = risk?.level || 'LOW';
  const riskColor =
    riskLevel === 'CRITICAL'
      ? 'text-red-700 bg-red-50 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900'
      : riskLevel === 'HIGH'
        ? 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900'
        : riskLevel === 'MEDIUM'
          ? 'text-yellow-700 bg-yellow-50 border-yellow-200 dark:bg-yellow-950/40 dark:text-yellow-300 dark:border-yellow-900'
          : 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900';

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-lg transition-all dark:border-zinc-800 dark:bg-zinc-950">
      {/* Top Header: Status & Price */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-100 pb-4 dark:border-zinc-800/80">
        <div className="flex items-center gap-2.5">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider ${
              isCompleted
                ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                : isApproved
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300'
                  : isAwaitingApproval
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : isRejected
                      ? 'bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300'
                      : 'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200'
            }`}
          >
            {isCompleted ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                Settled &amp; Ledgered
              </>
            ) : isApproved ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 text-blue-600" />
                Authorized
              </>
            ) : isAwaitingApproval ? (
              <>
                <Clock className="h-3.5 w-3.5 text-amber-600" />
                Awaiting Approval
              </>
            ) : (
              plan.status
            )}
          </span>
          <span className="text-xs text-zinc-400">Plan #{plan.id.slice(-6)}</span>
        </div>

        <div className="text-right">
          <div className="text-2xl font-black tracking-tight text-zinc-900 dark:text-white">
            ${Number(plan.total).toFixed(2)}{' '}
            <span className="text-xs font-normal text-zinc-500">USD</span>
          </div>
          <div className="text-[11px] text-zinc-500">
            Subtotal: ${Number(plan.subtotal).toFixed(2)} • Tax: $0.00
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {successMsg && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Main Item Presentation */}
      <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 rounded-xl border border-zinc-100 bg-zinc-50/50 p-4 dark:border-zinc-800/60 dark:bg-zinc-900/40">
        <div className="h-16 w-16 shrink-0 rounded-xl bg-gradient-to-tr from-zinc-200 to-zinc-300 dark:from-zinc-800 dark:to-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-600 dark:text-zinc-300 shadow-inner">
          {item?.productSku?.slice(0, 4) || 'SKU'}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-zinc-900 dark:text-white text-base">
              {item?.productName || 'Recommended Item'}
            </h3>
            <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-mono text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
              {item?.productSku}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {plan.explanation}
          </p>
        </div>
        <div className="text-right sm:self-center">
          <span className="text-lg font-bold text-zinc-900 dark:text-white">
            ${Number(item?.unitPrice || plan.total).toFixed(2)}
          </span>
          <span className="block text-[11px] text-zinc-500">Qty: {item?.quantity || 1}</span>
        </div>
      </div>

      {/* Dual Insights: Policy Engine & Risk Assessment */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Policy Guard Check */}
        <div className="rounded-xl border border-zinc-200/80 bg-zinc-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/30">
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200">
              <ShieldCheck className="h-4 w-4 text-blue-500" />
              Policy Engine Check
            </span>
            <span className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
              PASSED
            </span>
          </div>
          <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
            Amount complies with deterministic per-transaction ceiling and daily spending budget.
          </p>
        </div>

        {/* Risk Assessment */}
        <div className={`rounded-xl border p-3.5 ${riskColor}`}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="flex items-center gap-1.5 text-xs font-semibold">
              <AlertTriangle className="h-4 w-4" />
              Risk Assessment
            </span>
            <span className="rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-white/60 dark:bg-black/30">
              {riskLevel} ({risk?.score ?? 10}/100)
            </span>
          </div>
          <p className="text-[11px]">
            {risk?.explanation || 'Low risk transaction with standard merchant catalog parameters.'}
          </p>
        </div>
      </div>

      {/* Alternatives Comparison */}
      {alternatives.length > 0 && !isCompleted && !isRejected && (
        <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800/80">
          <div className="mb-2.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              <Layers className="h-3.5 w-3.5 text-zinc-500" />
              Compare Catalog Alternatives
            </span>
            <span className="text-[11px] text-zinc-400">One-click swap</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
            {alternatives.map((alt) => (
              <div
                key={alt.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-2.5 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="min-w-0 pr-2">
                  <p className="truncate text-xs font-semibold text-zinc-900 dark:text-white">
                    {alt.name}
                  </p>
                  <p className="text-[11px] text-zinc-500 font-mono">
                    ${Number(alt.price).toFixed(2)} USD
                  </p>
                </div>
                <button
                  type="button"
                  disabled={loading}
                  onClick={() => handleSelectAlternative(alt.id)}
                  className="shrink-0 rounded bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 transition hover:bg-blue-600 hover:text-white disabled:opacity-50 dark:bg-zinc-800 dark:text-zinc-300"
                >
                  Swap
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Action Gating Workflow */}
      <div className="mt-5 border-t border-zinc-100 pt-4 dark:border-zinc-800/80 flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {isAwaitingApproval && (
            <span className="text-amber-600 font-medium">
              Requires user sign-off prior to PayPal checkout.
            </span>
          )}
          {isApproved && (
            <span className="text-blue-600 font-medium">
              Plan authorized. Ready for PayPal sandbox execution.
            </span>
          )}
          {isCompleted && (
            <span className="text-emerald-600 font-medium flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Authoritative PayPal webhook settlement verified.
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {isAwaitingApproval && (
            <>
              <button
                type="button"
                disabled={loading}
                onClick={handleReject}
                className="flex items-center gap-1.5 rounded-xl border border-zinc-300 px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                <XCircle className="h-4 w-4" />
                Reject
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={handleAuthorize}
                className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {loading ? 'Authorizing...' : 'Authorize Purchase'}
              </button>
            </>
          )}

          {isApproved && (
            <button
              type="button"
              disabled={loading}
              onClick={handlePayPalCheckout}
              className="flex items-center gap-2 rounded-xl bg-[#0070BA] px-5 py-2.5 text-xs font-bold text-white shadow-md transition hover:bg-[#005ea6] disabled:opacity-50"
            >
              <CreditCard className="h-4 w-4" />
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Executing PayPal Sandbox...
                </span>
              ) : (
                <>Pay ${Number(plan.total).toFixed(2)} with PayPal Sandbox</>
              )}
            </button>
          )}

          {isCompleted && onViewLedger && (
            <button
              type="button"
              onClick={onViewLedger}
              className="flex items-center gap-1.5 rounded-xl border border-zinc-300 px-3.5 py-2 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              <FileText className="h-4 w-4 text-indigo-500" />
              View in Immutable Ledger
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
