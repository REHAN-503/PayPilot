'use client';

import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { api } from '../lib/api';
import type { Approval } from '../types';

interface ApprovalsViewProps {
  onApprovalDone: () => void;
}

export function ApprovalsView({ onApprovalDone }: ApprovalsViewProps) {
  const [loading, setLoading] = useState(true);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [actingId, setActingId] = useState<string | null>(null);

  function loadApprovals() {
    setLoading(true);
    setError(null);
    api
      .getPendingApprovals()
      .then((res) => {
        setApprovals(res || []);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load approvals');
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    let ignore = false;
    api
      .getPendingApprovals()
      .then((res) => {
        if (!ignore) {
          setApprovals(res || []);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load approvals');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  async function handleDecision(id: string, decision: 'APPROVED' | 'REJECTED') {
    setActingId(id);
    try {
      await api.submitDecision(id, decision);
      loadApprovals();
      onApprovalDone();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : `Failed to submit ${decision}`);
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex items-center justify-between border-b border-zinc-100 pb-4 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                Pending Purchase Authorizations
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Purchases flagged by Budget Guard or requiring explicit human-in-the-loop sign-off.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadApprovals}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </div>
        )}

        {approvals.length === 0 ? (
          <div className="py-12 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-500/50" />
            <h3 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">
              No pending authorizations
            </h3>
            <p className="mt-1 text-xs text-zinc-500">
              All proposed plans are either already authorized or settled.
            </p>
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            {approvals.map((appr) => {
              const plan = appr.plan;
              const item = plan?.items?.[0];
              const risk = plan?.riskAssessments?.[0];
              const isActing = actingId === appr.id;

              return (
                <div
                  key={appr.id}
                  className="rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 transition dark:border-zinc-800 dark:bg-zinc-900/40"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-zinc-900 dark:text-white text-sm">
                          {item?.productName || 'Purchase Item'}
                        </span>
                        <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-[10px] font-mono dark:bg-zinc-800">
                          {item?.productSku}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {appr.decisionNote || 'Policy check triggered user approval threshold.'}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-xl font-black text-zinc-900 dark:text-white">
                        ${Number(plan?.total || 0).toFixed(2)}{' '}
                        <span className="text-xs font-normal text-zinc-500">USD</span>
                      </div>
                      <span className="text-[11px] text-amber-600 font-medium">
                        Risk: {risk?.level || 'LOW'} ({risk?.score || 10}/100)
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end gap-2 border-t border-zinc-200/60 pt-3 dark:border-zinc-800">
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => handleDecision(appr.id, 'REJECTED')}
                      className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-100 hover:text-red-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Reject
                    </button>
                    <button
                      type="button"
                      disabled={isActing}
                      onClick={() => handleDecision(appr.id, 'APPROVED')}
                      className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      {isActing ? 'Processing...' : 'Authorize Purchase'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
