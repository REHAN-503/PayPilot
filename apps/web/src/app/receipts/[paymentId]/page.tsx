'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Download, Printer, ShieldAlert } from 'lucide-react';
import { DashboardShell } from '../../../components/layout/DashboardShell';
import { Card } from '../../../components/ui/card';
import { Button } from '../../../components/ui/button';
import { api } from '../../../lib/api';
import { formatCurrency } from '../../../lib/utils';

type Receipt = {
  merchant: string;
  amounts: { total: number; currency: string };
  policyRules: Array<{ name: string; value: number; limit: number | null; passed: boolean }>;
  risk: { score: number; level: string } | null;
  approval: { approvedAt: string | null; decisionNote: string | null } | null;
  paypal: { orderId: string | null; captureId: string | null; webhookConfirmedAt: string | null };
  chain: { valid: boolean; brokenAtEventId: string | null; events: number };
};

export default function ReceiptPage({ params }: { params: Promise<{ paymentId: string }> }) {
  const { paymentId } = React.use(params);
  const receiptQuery = useQuery({
    queryKey: ['receipt', paymentId],
    queryFn: () => api.getReceipt(paymentId) as Promise<Receipt>,
  });
  const verifyMutation = useQuery({
    queryKey: ['receipt-verify', paymentId],
    queryFn: () => api.verifyReceipt(paymentId),
    enabled: false,
  });
  const receipt = receiptQuery.data;

  const download = () => {
    if (!receipt) return;
    const blob = new Blob([JSON.stringify(receipt, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `paypilot-receipt-${paymentId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <DashboardShell>
      <div className="space-y-6 print:text-[var(--ink)]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-black text-[var(--ink)] print:text-[var(--ink)]">Trust Receipt</h1>
            <p className="text-sm text-[var(--ink-3)]">{receipt?.merchant ?? 'Loading receipt...'}</p>
          </div>
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" onClick={download} disabled={!receipt}><Download className="mr-2 h-4 w-4" />Download JSON</Button>
            <Button variant="outline" onClick={() => window.print()}><Printer className="mr-2 h-4 w-4" />Print / save PDF</Button>
          </div>
        </div>
        {receipt && (
          <>
            <Card className="p-5">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-[var(--ink)] print:text-[var(--ink)]">Chain verification</h2>
                <span className={receipt.chain.valid ? 'text-[var(--verdigris)]' : 'text-[var(--vermilion)]'}>
                  {receipt.chain.valid ? <><CheckCircle2 className="mr-1 inline h-4 w-4" />Verified chain ✓ ({receipt.chain.events} events)</> : <><ShieldAlert className="mr-1 inline h-4 w-4" />Chain broken at event {receipt.chain.brokenAtEventId}</>}
                </span>
              </div>
              <Button className="mt-4 print:hidden" variant="outline" onClick={() => verifyMutation.refetch()}>
                {verifyMutation.isFetching ? 'Recomputing...' : 'Recompute live'}
              </Button>
              {verifyMutation.data && !verifyMutation.data.valid && <p className="mt-2 text-sm text-[var(--vermilion)]">Chain broken at event {verifyMutation.data.brokenAtEventId}</p>}
            </Card>
            <Card className="grid gap-4 p-5 sm:grid-cols-2">
              <div><p className="text-xs text-[var(--ink-3)]">Total</p><p className="text-2xl font-bold text-[var(--ink)] print:text-[var(--ink)]">{formatCurrency(receipt.amounts.total)}</p></div>
              <div><p className="text-xs text-[var(--ink-3)]">Risk</p><p className="text-[var(--ink)] print:text-[var(--ink)]">{receipt.risk ? `${receipt.risk.level} (${receipt.risk.score})` : 'Not recorded'}</p></div>
              <div><p className="text-xs text-[var(--ink-3)]">PayPal order / capture</p><p className="text-[var(--ink)] print:text-[var(--ink)]">{receipt.paypal.orderId ?? '—'} / {receipt.paypal.captureId ?? '—'}</p></div>
              <div><p className="text-xs text-[var(--ink-3)]">Webhook confirmed</p><p className="text-[var(--ink)] print:text-[var(--ink)]">{receipt.paypal.webhookConfirmedAt ?? 'Pending'}</p></div>
            </Card>
            <Card className="p-5">
              <h2 className="mb-3 font-bold text-[var(--ink)] print:text-[var(--ink)]">Policy rules evaluated</h2>
              <div className="space-y-2">{receipt.policyRules.map((rule) => <div key={rule.name} className="flex justify-between border-b border-[var(--rule)] py-2 text-sm"><span className="text-[var(--ink-2)]">{rule.name}</span><span className={rule.passed ? 'text-[var(--verdigris)]' : 'text-[var(--vermilion)]'}>{rule.passed ? 'PASS' : 'FAIL'} · {rule.value} / {rule.limit ?? '—'}</span></div>)}</div>
            </Card>
          </>
        )}
      </div>
    </DashboardShell>
  );
}
