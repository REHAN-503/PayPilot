'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  CreditCard,
  AlertTriangle,
  Copy,
  Check,
  Webhook,
  Sparkles,
  PlayCircle,
} from 'lucide-react';
import { DashboardShell } from '../../../components/layout/DashboardShell';
import { Card } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Button } from '../../../components/ui/button';
import { Skeleton } from '../../../components/ui/progress';
import { api } from '../../../lib/api';
import { formatCurrency, formatDate } from '../../../lib/utils';
import { useEventStream } from '../../../hooks/useEventStream';
import { toast } from 'sonner';

function PaymentDetailContent() {
  const params = useParams();
  const paymentId = params.id as string;
  const [copiedKey, setCopiedKey] = React.useState<string | null>(null);
  const [isSimulating, setIsSimulating] = React.useState(false);
  const [isCancelling, setIsCancelling] = React.useState(false);

  const { data: payment, isLoading, refetch } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: () => api.getPayment(paymentId),
    enabled: !!paymentId,
    refetchInterval: 4000,
  });

  useEventStream(() => {
    refetch();
  });

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const handleSimulate = async (eventType: string) => {
    try {
      setIsSimulating(true);
      const res = await api.simulateWebhook(
        eventType,
        payment?.paypalOrderId || undefined,
        payment?.paypalCaptureId || undefined,
      );
      toast.success(`Webhook Simulated: ${eventType}`, {
        description: res.result?.status ? `Result: ${res.result.status}` : 'Event processed',
      });
      await refetch();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Simulation Failed', { description: message });
    } finally {
      setIsSimulating(false);
    }
  };

  const handleCancel = async () => {
    try {
      setIsCancelling(true);
      await api.cancelPayment(paymentId);
      toast.success('Payment cancelled');
      await refetch();
    } catch (err: unknown) {
      toast.error('Unable to cancel payment', {
        description: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading) {
    return (
      <DashboardShell>
        <div className="space-y-6">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-80 w-full" />
        </div>
      </DashboardShell>
    );
  }

  if (!payment) {
    return (
      <DashboardShell>
        <div className="text-center p-12 rounded-3xl border border-[var(--rule)] bg-[var(--card)]/40">
          <AlertTriangle className="w-10 h-10 text-[var(--amber)] mx-auto mb-3" />
          <h2 className="text-lg font-bold text-[var(--ink)]">Payment Record Not Found</h2>
          <p className="text-xs text-[var(--ink-3)] mt-1">Payment ID: {paymentId}</p>
          <Link href="/transactions" className="mt-4 inline-block">
            <Button variant="outline" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Transactions
            </Button>
          </Link>
        </div>
      </DashboardShell>
    );
  }

  const isCaptured = payment.status === 'CAPTURED';
  const isConfirmed = !!payment.webhookConfirmedAt;
  const amount = Number(payment.amount);

  return (
    <DashboardShell>
      <div className="space-y-6">
        {/* Top Breadcrumb & Status Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/transactions">
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-[var(--radius)]">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--ink)] tracking-tight">
                  PayPal Transaction Detail
                </h1>
                <Badge variant={isCaptured ? 'success' : 'warning'}>
                  {payment.status}
                </Badge>
                {isConfirmed && (
                  <Badge variant="default" className="bg-[var(--ledger)]/20 text-[var(--ledger)] border-[var(--ledger)]">
                    Webhook Confirmed
                  </Badge>
                )}
              </div>
              <p className="text-xs text-[var(--ink-3)] mt-0.5">
                Internal Payment ID: {payment.id} • Created {formatDate(payment.createdAt)}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-black text-[var(--ink)] font-mono">
              {formatCurrency(amount)}
            </div>
            <div className="text-xs text-[var(--verdigris)] font-medium">USD • Intent CAPTURE</div>
          </div>
        </div>

        {payment.status !== 'CAPTURED' && payment.status !== 'CANCELLED' && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              disabled={isCancelling}
              className="text-[var(--vermilion)] border-[var(--vermilion)] hover:bg-[var(--paper-2)]"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel payment'}
            </Button>
          </div>
        )}
        <div className="flex justify-end">
          <Link href={`/receipts/${payment.id}`}>
            <Button variant="outline" size="sm">View trust receipt</Button>
          </Link>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Details (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* PayPal Gateway Identifiers */}
            <Card className="border-[var(--rule)] bg-[var(--card)] p-6 ">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] mb-4 pb-2 border-b border-[var(--rule)] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-[var(--ledger)]" />
                PayPal Orders v2 Identification
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-[var(--radius)] bg-[var(--paper)]/70 border border-[var(--rule)] text-xs">
                  <div>
                    <span className="text-[var(--ink-3)] block text-[10px] uppercase font-semibold">
                      PayPal Order ID
                    </span>
                    <span className="font-mono text-[var(--ink)] font-semibold">
                      {payment.paypalOrderId || 'PENDING_CREATION'}
                    </span>
                  </div>
                  {payment.paypalOrderId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(payment.paypalOrderId!, 'order')}
                      className="h-8 text-xs text-[var(--ledger)] hover:text-[var(--ink)]"
                    >
                      {copiedKey === 'order' ? (
                        <Check className="w-3.5 h-3.5 text-[var(--verdigris)]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-[var(--radius)] bg-[var(--paper)]/70 border border-[var(--rule)] text-xs">
                  <div>
                    <span className="text-[var(--ink-3)] block text-[10px] uppercase font-semibold">
                      PayPal Capture ID
                    </span>
                    <span className="font-mono text-[var(--ink)] font-semibold">
                      {payment.paypalCaptureId || 'PENDING_CAPTURE'}
                    </span>
                  </div>
                  {payment.paypalCaptureId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(payment.paypalCaptureId!, 'capture')}
                      className="h-8 text-xs text-[var(--ledger)] hover:text-[var(--ink)]"
                    >
                      {copiedKey === 'capture' ? (
                        <Check className="w-3.5 h-3.5 text-[var(--verdigris)]" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-[var(--radius)] bg-[var(--paper)]/70 border border-[var(--rule)] text-xs">
                  <div>
                    <span className="text-[var(--ink-3)] block text-[10px] uppercase font-semibold">
                      Ledger Idempotency Key
                    </span>
                    <span className="font-mono text-[var(--ink-2)] text-[11px] truncate max-w-sm block">
                      {payment.idempotencyKey}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(payment.idempotencyKey, 'idem')}
                    className="h-8 text-xs text-[var(--ledger)] hover:text-[var(--ink)]"
                  >
                    {copiedKey === 'idem' ? (
                      <Check className="w-3.5 h-3.5 text-[var(--verdigris)]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Recommended Next Action */}
            <Card className="border-[var(--rule)] bg-[var(--card)] p-5">
              <h4 className="text-xs font-semibold text-[var(--ledger)] uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Recommended Next Action
              </h4>
              <p className="text-xs text-[var(--ink-2)] leading-relaxed">
                {isConfirmed
                  ? 'Payment has been authoritatively verified via PayPal webhook and stamped to the immutable ledger. No action required.'
                  : isCaptured
                  ? 'Payment is captured in sandbox. Awaiting webhook delivery from PayPal. You can use the Sandbox Simulator below to simulate instant webhook verification.'
                  : 'Payer action required. Complete the PayPal Smart Checkout dialog to authorize fund capture.'}
              </p>
            </Card>
          </div>

          {/* Right Column: Webhook Status & Simulator (4 cols) */}
          <div className="lg:col-span-4 space-y-6">
            {/* Cryptographic Webhook Confirmation */}
            <Card className="border-[var(--rule)] bg-[var(--card)] p-5 ">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-[var(--rule)]">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] flex items-center gap-1.5">
                  <Webhook className="w-3.5 h-3.5 text-[var(--verdigris)]" />
                  Webhook Status
                </h4>
                <Badge variant={isConfirmed ? 'success' : 'warning'}>
                  {isConfirmed ? 'Confirmed' : 'Pending'}
                </Badge>
              </div>

              <div className="space-y-2 text-xs text-[var(--ink-2)]">
                <div className="flex justify-between">
                  <span className="text-[var(--ink-3)]">Captured At:</span>
                  <span className="font-mono text-[var(--ink)]">{formatDate(payment.capturedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[var(--ink-3)]">Webhook Confirmed:</span>
                  <span className="font-mono text-[var(--ink)]">{formatDate(payment.webhookConfirmedAt)}</span>
                </div>
              </div>
            </Card>

            {/* Dev Sandbox Simulator Panel */}
            <Card className="border-[var(--amber)] bg-[var(--card)] p-5 ">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-[var(--amber)]">
                  <PlayCircle className="w-4 h-4 text-[var(--amber)]" />
                  <span>Sandbox Simulator</span>
                </div>
                <Badge variant="warning">Dev Tool</Badge>
              </div>
              <p className="text-[11px] text-[var(--ink-3)] mb-4 leading-relaxed">
                Simulate asynchronous PayPal webhook events to test authoritative confirmation, idempotency, or denial handlers.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSimulate('PAYMENT.CAPTURE.COMPLETED')}
                  disabled={isSimulating}
                  className="text-xs text-[var(--verdigris)] hover:bg-[var(--paper-2)] hover:border-[var(--verdigris)]"
                >
                  Confirm (200)
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSimulate('PAYMENT.CAPTURE.DENIED')}
                  disabled={isSimulating}
                  className="text-xs text-[var(--vermilion)] hover:bg-[var(--paper-2)] hover:border-[var(--vermilion)]"
                >
                  Simulate Denied
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSimulate('PAYMENT.CAPTURE.REVERSED')}
                  disabled={isSimulating}
                  className="text-xs text-[var(--amber)] hover:bg-[var(--paper-2)] hover:border-[var(--amber)]"
                >
                  Simulate Reversed
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSimulate('duplicate')}
                  disabled={isSimulating}
                  className="text-xs text-[var(--ledger)] hover:bg-[var(--paper-2)] hover:border-[var(--ledger)]/50"
                >
                  Duplicate Test
                </Button>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}

export default function PaymentDetailPage() {
  return (
    <React.Suspense
      fallback={
        <div className="min-h-screen bg-[var(--paper)] flex items-center justify-center text-[var(--ink-3)]">
          Loading payment ledger...
        </div>
      }
    >
      <PaymentDetailContent />
    </React.Suspense>
  );
}
