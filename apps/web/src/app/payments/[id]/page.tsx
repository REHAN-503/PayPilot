'use client';

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
        <div className="text-center p-12 rounded-3xl border border-slate-800 bg-slate-900/40">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-white">Payment Record Not Found</h2>
          <p className="text-xs text-slate-400 mt-1">Payment ID: {paymentId}</p>
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
              <Button variant="outline" size="icon" className="h-9 w-9 rounded-xl">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                  PayPal Transaction Detail
                </h1>
                <Badge variant={isCaptured ? 'success' : 'warning'}>
                  {payment.status}
                </Badge>
                {isConfirmed && (
                  <Badge variant="default" className="bg-blue-600/20 text-blue-400 border-blue-500/30">
                    Webhook Confirmed
                  </Badge>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Internal Payment ID: {payment.id} • Created {formatDate(payment.createdAt)}
              </p>
            </div>
          </div>

          <div className="text-right">
            <div className="text-2xl sm:text-3xl font-black text-white font-mono">
              {formatCurrency(amount)}
            </div>
            <div className="text-xs text-emerald-400 font-medium">USD • Intent CAPTURE</div>
          </div>
        </div>

        {/* 2-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Details (8 cols) */}
          <div className="lg:col-span-8 space-y-6">
            {/* PayPal Gateway Identifiers */}
            <Card className="border-slate-800 bg-slate-900/80 p-6 shadow-xl">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4 pb-2 border-b border-slate-800 flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-blue-400" />
                PayPal Orders v2 Identification
              </h3>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      PayPal Order ID
                    </span>
                    <span className="font-mono text-slate-200 font-semibold">
                      {payment.paypalOrderId || 'PENDING_CREATION'}
                    </span>
                  </div>
                  {payment.paypalOrderId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(payment.paypalOrderId!, 'order')}
                      className="h-8 text-xs text-blue-400 hover:text-white"
                    >
                      {copiedKey === 'order' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      PayPal Capture ID
                    </span>
                    <span className="font-mono text-slate-200 font-semibold">
                      {payment.paypalCaptureId || 'PENDING_CAPTURE'}
                    </span>
                  </div>
                  {payment.paypalCaptureId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(payment.paypalCaptureId!, 'capture')}
                      className="h-8 text-xs text-blue-400 hover:text-white"
                    >
                      {copiedKey === 'capture' ? (
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  )}
                </div>

                <div className="flex items-center justify-between p-3 rounded-xl bg-slate-950/70 border border-slate-800 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">
                      Ledger Idempotency Key
                    </span>
                    <span className="font-mono text-slate-300 text-[11px] truncate max-w-sm block">
                      {payment.idempotencyKey}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(payment.idempotencyKey, 'idem')}
                    className="h-8 text-xs text-blue-400 hover:text-white"
                  >
                    {copiedKey === 'idem' ? (
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </Button>
                </div>
              </div>
            </Card>

            {/* Recommended Next Action */}
            <Card className="border-slate-800 bg-slate-900/60 p-5">
              <h4 className="text-xs font-semibold text-blue-400 uppercase tracking-wider flex items-center gap-1.5 mb-2">
                <Sparkles className="w-3.5 h-3.5" />
                Recommended Next Action
              </h4>
              <p className="text-xs text-slate-300 leading-relaxed">
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
            <Card className="border-slate-800 bg-slate-900/80 p-5 shadow-lg">
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-800">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Webhook className="w-3.5 h-3.5 text-emerald-400" />
                  Webhook Status
                </h4>
                <Badge variant={isConfirmed ? 'success' : 'warning'}>
                  {isConfirmed ? 'Confirmed' : 'Pending'}
                </Badge>
              </div>

              <div className="space-y-2 text-xs text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">Captured At:</span>
                  <span className="font-mono text-slate-200">{formatDate(payment.capturedAt)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Webhook Confirmed:</span>
                  <span className="font-mono text-slate-200">{formatDate(payment.webhookConfirmedAt)}</span>
                </div>
              </div>
            </Card>

            {/* Dev Sandbox Simulator Panel */}
            <Card className="border-amber-500/30 bg-gradient-to-b from-slate-900 to-amber-950/20 p-5 shadow-xl">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-300">
                  <PlayCircle className="w-4 h-4 text-amber-400" />
                  <span>Sandbox Simulator</span>
                </div>
                <Badge variant="warning">Dev Tool</Badge>
              </div>
              <p className="text-[11px] text-slate-400 mb-4 leading-relaxed">
                Simulate asynchronous PayPal webhook events to test authoritative confirmation, idempotency, or denial handlers.
              </p>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSimulate('PAYMENT.CAPTURE.COMPLETED')}
                  disabled={isSimulating}
                  className="text-xs text-emerald-400 hover:bg-emerald-950/40 hover:border-emerald-500/50"
                >
                  Confirm (200)
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSimulate('PAYMENT.CAPTURE.DENIED')}
                  disabled={isSimulating}
                  className="text-xs text-red-400 hover:bg-red-950/40 hover:border-red-500/50"
                >
                  Simulate Denied
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSimulate('PAYMENT.CAPTURE.REVERSED')}
                  disabled={isSimulating}
                  className="text-xs text-amber-400 hover:bg-amber-950/40 hover:border-amber-500/50"
                >
                  Simulate Reversed
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleSimulate('duplicate')}
                  disabled={isSimulating}
                  className="text-xs text-blue-400 hover:bg-blue-950/40 hover:border-blue-500/50"
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
        <div className="min-h-screen bg-[#070b14] flex items-center justify-center text-slate-400">
          Loading payment ledger...
        </div>
      }
    >
      <PaymentDetailContent />
    </React.Suspense>
  );
}

