'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { X, Sliders, ShieldCheck, Check, DollarSign, AlertCircle } from 'lucide-react';
import { api } from '../lib/api';

interface PolicyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPolicyUpdated: () => void;
}

interface SpendMetrics {
  dailySpent: number;
  dailyLimit: number | null;
  dailyRemaining: number | null;
  monthlySpent: number;
  monthlyLimit: number | null;
  monthlyRemaining: number | null;
}

export function PolicyModal({
  isOpen,
  onClose,
  onPolicyUpdated,
}: PolicyModalProps) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [autonomyMode, setAutonomyMode] = useState<
    'ASK_EVERY_TIME' | 'AUTO_WITHIN_LIMITS' | 'MANUAL_APPROVAL'
  >('ASK_EVERY_TIME');
  const [maxTransaction, setMaxTransaction] = useState('250');
  const [dailyLimit, setDailyLimit] = useState('500');
  const [approvalThreshold, setApprovalThreshold] = useState('100');
  const [allowAutoExecute, setAllowAutoExecute] = useState(false);
  const [spendMetrics, setSpendMetrics] = useState<SpendMetrics | null>(null);

  const loadPolicy = useCallback(() => {
    api
      .getPolicy()
      .then((res) => {
        if (res.policy) {
          setAutonomyMode(res.policy.autonomyMode || 'ASK_EVERY_TIME');
          setMaxTransaction(res.policy.maxTransactionAmount?.toString() || '250');
          setDailyLimit(res.policy.dailySpendingLimit?.toString() || '500');
          setApprovalThreshold(res.policy.requireApprovalAbove?.toString() || '100');
          setAllowAutoExecute(Boolean(res.policy.allowAutoExecute));
        }
        if (res.spendMetrics) {
          setSpendMetrics(res.spendMetrics);
        }
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load policy');
      });
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadPolicy();
    }
  }, [isOpen, loadPolicy]);

  if (!isOpen) return null;

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);

    try {
      await api.updatePolicy({
        autonomyMode,
        maxTransactionAmount: maxTransaction ? Number(maxTransaction) : null,
        dailySpendingLimit: dailyLimit ? Number(dailyLimit) : null,
        requireApprovalAbove: approvalThreshold ? Number(approvalThreshold) : null,
        allowAutoExecute,
      });

      setSuccess(true);
      onPolicyUpdated();
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update policy');
    } finally {
      setSaving(false);
    }
  }

  const dailySpent = spendMetrics?.dailySpent || 0;
  const currentDailyCap = dailyLimit ? Number(dailyLimit) : 500;
  const budgetRatio = Math.min(100, Math.round((dailySpent / currentDailyCap) * 100));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-lg rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
            <Sliders className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
              Budget Guard & Policy Engine
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Deterministic boundaries enforced prior to any PayPal transaction.
            </p>
          </div>
        </div>

        {/* Live Daily Budget Gauge */}
        <div className="mb-5 rounded-xl border border-zinc-200 bg-zinc-50 p-3.5 dark:border-zinc-800 dark:bg-zinc-900/50">
          <div className="mb-1.5 flex items-center justify-between text-xs">
            <span className="font-semibold text-zinc-700 dark:text-zinc-300">
              Today&apos;s Budget Utilization
            </span>
            <span className="font-mono text-zinc-900 dark:text-zinc-100">
              ${dailySpent.toFixed(2)} / ${currentDailyCap.toFixed(2)} ({budgetRatio}%)
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
            <div
              className={`h-full transition-all duration-500 ${
                budgetRatio > 80
                  ? 'bg-amber-500'
                  : budgetRatio >= 100
                    ? 'bg-red-500'
                    : 'bg-emerald-500'
              }`}
              style={{ width: `${budgetRatio}%` }}
            />
          </div>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Check className="h-4 w-4 shrink-0" />
            <span>Policy limits successfully saved!</span>
          </div>
        )}

        <form onSubmit={handleSave} className="space-y-4">
          {/* Autonomy Mode Selector */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Agent Autonomy Mode
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAutonomyMode('ASK_EVERY_TIME');
                  setAllowAutoExecute(false);
                }}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                  autonomyMode === 'ASK_EVERY_TIME'
                    ? 'border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/30'
                    : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900'
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 dark:text-white">
                  Ask Always
                </span>
                <span className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  User authorizes every single payment.
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAutonomyMode('AUTO_WITHIN_LIMITS');
                  setAllowAutoExecute(true);
                }}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                  autonomyMode === 'AUTO_WITHIN_LIMITS'
                    ? 'border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/30'
                    : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900'
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 dark:text-white">
                  Auto (Limits)
                </span>
                <span className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Auto-pays under threshold; asks over it.
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setAutonomyMode('MANUAL_APPROVAL');
                  setAllowAutoExecute(false);
                }}
                className={`flex flex-col items-start rounded-xl border p-3 text-left transition ${
                  autonomyMode === 'MANUAL_APPROVAL'
                    ? 'border-blue-600 bg-blue-50/50 dark:border-blue-500 dark:bg-blue-950/30'
                    : 'border-zinc-200 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900'
                }`}
              >
                <span className="text-xs font-bold text-zinc-900 dark:text-white">
                  Strict
                </span>
                <span className="mt-1 text-[11px] text-zinc-500 dark:text-zinc-400">
                  Requires manual dual verification.
                </span>
              </button>
            </div>
          </div>

          {/* Hard Limits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Max Per Transaction ($)
              </label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={maxTransaction}
                  onChange={(e) => setMaxTransaction(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 pl-8 pr-3 py-1.5 text-sm font-mono text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Daily Budget Cap ($)
              </label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 pl-8 pr-3 py-1.5 text-sm font-mono text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Approval Threshold ($)
              </label>
              <div className="relative mt-1">
                <DollarSign className="absolute left-2.5 top-2.5 h-4 w-4 text-zinc-400" />
                <input
                  type="number"
                  step="0.01"
                  min="1"
                  value={approvalThreshold}
                  onChange={(e) => setApprovalThreshold(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 pl-8 pr-3 py-1.5 text-sm font-mono text-zinc-900 outline-none focus:border-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                />
              </div>
            </div>
          </div>

          {autonomyMode === 'AUTO_WITHIN_LIMITS' && (
            <label className="flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50/30 p-3 text-xs text-blue-900 dark:border-blue-900 dark:bg-blue-950/20 dark:text-blue-200 cursor-pointer">
              <input
                type="checkbox"
                checked={allowAutoExecute}
                onChange={(e) => setAllowAutoExecute(e.target.checked)}
                className="h-4 w-4 rounded border-blue-300 text-blue-600 focus:ring-blue-500"
              />
              <span>
                Allow autonomous PayPal payment execution for compliant plans under ${approvalThreshold || '100'}
              </span>
            </label>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-zinc-300 px-4 py-2 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-50"
            >
              <ShieldCheck className="h-4 w-4" />
              {saving ? 'Saving...' : 'Save Policy'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
