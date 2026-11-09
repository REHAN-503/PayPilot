'use client';

import React, { useState, useEffect } from 'react';
import { FileText, ShieldCheck, RefreshCw } from 'lucide-react';
import { api, type LedgerResponse } from '../lib/api';

export function LedgerView() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<LedgerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadLedger() {
    setLoading(true);
    setError(null);
    api
      .getLedger()
      .then((res) => {
        setData(res);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to load ledger records');
      })
      .finally(() => {
        setLoading(false);
      });
  }

  useEffect(() => {
    let ignore = false;
    api
      .getLedger()
      .then((res) => {
        if (!ignore) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) {
          setError(err instanceof Error ? err.message : 'Failed to load ledger records');
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  const transactions = data?.transactions || [];
  const summary = data?.summary || { count: 0, totalCaptured: 0, netSpend: 0 };

  return (
    <div className="space-y-6">
      {/* Top Ledger Overview Card */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-zinc-100 pb-5 dark:border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-950/60 dark:text-indigo-400">
              <FileText className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                  Immutable Transaction Ledger
                </h2>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  <ShieldCheck className="h-3 w-3" />
                  Append-Only
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Audited financial ledger enforced via PostgreSQL trigger. No updates or deletions permitted.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={loadLedger}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Ledger Summary Stats */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40">
            <span className="text-xs font-medium text-zinc-500">Verified Net Volume</span>
            <div className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">
              ${Number(summary.netSpend || 0).toFixed(2)}{' '}
              <span className="text-xs font-normal text-zinc-500">USD</span>
            </div>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40">
            <span className="text-xs font-medium text-zinc-500">Total Entries Recorded</span>
            <div className="mt-1 text-2xl font-black text-zinc-900 dark:text-white">
              {summary.count}
            </div>
          </div>

          <div className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-4 dark:border-zinc-800/80 dark:bg-zinc-900/40">
            <span className="text-xs font-medium text-zinc-500">Settlement Verification</span>
            <div className="mt-1 flex items-center gap-1.5 text-sm font-bold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="h-4 w-4" />
              PayPal Webhook Guaranteed
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Transactions Table */}
      <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200 dark:divide-zinc-800 text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th scope="col" className="px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-400">
                  Timestamp
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-400">
                  Entry Type
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-400">
                  Item / Plan
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-400">
                  Amount (USD)
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-400">
                  External Reference (Capture ID)
                </th>
                <th scope="col" className="px-4 py-3 font-semibold text-zinc-600 dark:text-zinc-400">
                  Idempotency Key
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {transactions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-400">
                    No transactions settled yet. Execute your first approved plan to record a ledger entry.
                  </td>
                </tr>
              ) : (
                transactions.map((tx) => {
                  const dateStr = new Date(tx.createdAt).toLocaleString();
                  const item = tx.payment?.plan?.items?.[0];

                  return (
                    <tr key={tx.id} className="hover:bg-zinc-50/50 dark:hover:bg-zinc-900/50">
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-zinc-500">
                        {dateStr}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5">
                        <span className="inline-flex items-center gap-1 rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                          {tx.type}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="font-semibold text-zinc-900 dark:text-white">
                          {item?.productName || 'Commerce Plan'}
                        </div>
                        <div className="text-[11px] text-zinc-400 font-mono">
                          {item?.productSku || tx.paymentId.slice(-8)}
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono font-bold text-zinc-900 dark:text-white">
                        ${Number(tx.amount).toFixed(2)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[11px] text-zinc-600 dark:text-zinc-300">
                        {tx.externalReference || '—'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-mono text-[10px] text-zinc-400" title={tx.idempotencyKey}>
                        {tx.idempotencyKey.slice(0, 13)}...
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
