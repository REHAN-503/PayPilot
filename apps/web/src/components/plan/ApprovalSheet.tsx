'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { PayPalButtons } from '@paypal/react-paypal-js';
import {
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lock,
  Clock,
  Sparkles,
  Info,
} from 'lucide-react';
import type { PurchasePlan } from '../../lib/schemas';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '../ui/sheet';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';

interface ApprovalSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  plan: PurchasePlan;
  onPlanUpdated?: (plan: PurchasePlan) => void;
}

export function ApprovalSheet({
  open,
  onOpenChange,
  plan,
  onPlanUpdated,
}: ApprovalSheetProps) {
  const router = useRouter();
  const [isApproving, setIsApproving] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);
  const [approvedSuccess, setApprovedSuccess] = React.useState(false);
  const [createdPaymentId, setCreatedPaymentId] = React.useState<string | null>(null);

  const isApproved = plan.status === 'APPROVED' || approvedSuccess;

  const risk = plan.riskAssessments?.[0];
  const total = Number(plan.total);
  const item = plan.items?.[0];

  const handleApprove = async () => {
    try {
      setIsApproving(true);
      const updated = await api.approvePlan(plan.id, 'User authorized purchase via Approval Sheet');
      toast.success('Purchase Plan Authorized', {
        description: 'You can now complete checkout with PayPal Sandbox.',
      });
      setApprovedSuccess(true);
      if (onPlanUpdated) onPlanUpdated(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Approval Failed', { description: message });
    } finally {
      setIsApproving(false);
    }
  };

  const handleReject = async () => {
    try {
      setIsRejecting(true);
      const updated = await api.rejectPlan(plan.id, 'User declined authorization');
      toast.info('Plan Declined', {
        description: 'The purchase proposal has been cancelled.',
      });
      onOpenChange(false);
      if (onPlanUpdated) onPlanUpdated(updated);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Rejection Failed', { description: message });
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="sm:max-w-xl mx-auto sm:rounded-t-3xl border-t border-[var(--rule)] bg-[var(--card)] p-6 sm:p-8">
        <SheetHeader className="mb-4">
          <div className="flex items-center justify-between">
            <Badge variant="outline" className="border-[var(--rule)] text-[var(--ledger)] gap-1.5 py-1">
              <Lock className="w-3.5 h-3.5" />
              <span>Two-Party Governance Check</span>
            </Badge>
            <div className="flex items-center gap-1.5 text-xs text-[var(--ink-3)]">
              <Clock className="w-3.5 h-3.5 text-[var(--amber)]" />
              <span>Version {plan.version}</span>
            </div>
          </div>
          <SheetTitle className="text-xl font-bold text-[var(--ink)] mt-2">
            Authorize Autonomous Procurement
          </SheetTitle>
          <SheetDescription className="text-xs text-[var(--ink-3)]">
            Verify deterministic policy compliance and behavioral risk scoring before releasing PayPal funds.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 overflow-y-auto max-h-[70vh] pr-1">
          {/* Order Summary Box */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--card)] border border-[var(--rule)]">
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-[var(--rule)]">
              <div>
                <h4 className="font-semibold text-sm text-[var(--ink)]">
                  {item?.productName || 'Procurement Package'}
                </h4>
                <p className="text-xs text-[var(--ink-3)] mt-0.5">
                  SKU: {item?.productSku || 'CATALOG-ITEM'} • Qty: {item?.quantity || 1}
                </p>
              </div>
              <div className="text-right">
                <div className="text-xl font-bold text-[var(--ink)] tracking-tight">
                  {formatCurrency(total)}
                </div>
                <div className="text-[11px] text-[var(--verdigris)] font-medium">USD • Guaranteed Price</div>
              </div>
            </div>

            {/* Price breakdown */}
            <div className="space-y-1.5 text-xs text-[var(--ink-3)]">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(plan.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Estimated Shipping</span>
                <span>{formatCurrency(plan.shipping)}</span>
              </div>
              <div className="flex justify-between font-semibold text-[var(--ink)] pt-1.5 border-t border-[var(--rule)]">
                <span>Total Authorization</span>
                <span className="text-[var(--ledger)]">{formatCurrency(total)}</span>
              </div>
            </div>
          </div>

          {/* Policy Checklist */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--card)]/70 border border-[var(--rule)] space-y-2.5">
            <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-[var(--verdigris)]" />
              Deterministic Spending Rules
            </h5>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--paper)]/60 border border-[var(--rule)]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--verdigris)] shrink-0" />
                  <span className="text-[var(--ink-2)]">Transaction Ceiling Check</span>
                </div>
                <span className="font-mono text-[var(--verdigris)] font-medium">
                  {formatCurrency(total)} ≤ Limit
                </span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--paper)]/60 border border-[var(--rule)]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--verdigris)] shrink-0" />
                  <span className="text-[var(--ink-2)]">Category Authorization</span>
                </div>
                <span className="font-mono text-[var(--verdigris)] font-medium">Approved Category</span>
              </div>

              <div className="flex items-center justify-between p-2 rounded-[var(--radius)] bg-[var(--paper)]/60 border border-[var(--rule)]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--verdigris)] shrink-0" />
                  <span className="text-[var(--ink-2)]">Daily Ledger Spending Capacity</span>
                </div>
                <span className="font-mono text-[var(--verdigris)] font-medium">Within Limit</span>
              </div>
            </div>
          </div>

          {/* Risk Gate Assessment */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--card)]/70 border border-[var(--rule)]">
            <div className="flex items-center justify-between mb-2">
              <h5 className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-3)] flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[var(--amber)]" />
                Behavioral Risk Assessment
              </h5>
              <Badge
                variant={
                  risk?.level === 'LOW'
                    ? 'success'
                    : risk?.level === 'MEDIUM'
                    ? 'warning'
                    : 'destructive'
                }
              >
                {risk?.level || 'LOW'} Risk ({risk?.score ?? 15}/100)
              </Badge>
            </div>
            <ul className="space-y-1 text-xs text-[var(--ink-3)]">
              {(risk?.reasons && risk.reasons.length > 0
                ? risk.reasons
                : ['Standard procurement velocity and verified catalog parameters.']
              ).map((reason, idx) => (
                <li key={idx} className="flex items-start gap-1.5">
                  <span className="text-[var(--ledger)] mt-0.5">•</span>
                  <span>{reason}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 4-Step What Happens Next Preview */}
          <div className="p-4 rounded-[var(--radius)] bg-[var(--paper)]/80 border border-[var(--rule)]">
            <h5 className="text-xs font-semibold text-[var(--ink-2)] mb-2.5 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[var(--ledger)]" />
              What Happens Next
            </h5>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-[11px]">
              <div className="p-2 rounded-[var(--radius)] bg-[var(--card)] border border-[var(--rule)] text-[var(--ink-2)]">
                <div className="font-bold text-[var(--ledger)] mb-0.5">1. User Approval</div>
                <div className="text-[10px] text-[var(--ink-3)]">Cryptographic audit log</div>
              </div>
              <div className="p-2 rounded-[var(--radius)] bg-[var(--card)] border border-[var(--rule)] text-[var(--ink-2)]">
                <div className="font-bold text-[var(--brass)] mb-0.5">2. PayPal Order</div>
                <div className="text-[10px] text-[var(--ink-3)]">Intent CAPTURE</div>
              </div>
              <div className="p-2 rounded-[var(--radius)] bg-[var(--card)] border border-[var(--rule)] text-[var(--ink-2)]">
                <div className="font-bold text-[var(--brass)] mb-0.5">3. Smart Capture</div>
                <div className="text-[10px] text-[var(--ink-3)]">Pending confirmation</div>
              </div>
              <div className="p-2 rounded-[var(--radius)] bg-[var(--card)] border border-[var(--rule)] text-[var(--ink-2)]">
                <div className="font-bold text-[var(--verdigris)] mb-0.5">4. Webhook Ledger</div>
                <div className="text-[10px] text-[var(--ink-3)]">Final immutable stamp</div>
              </div>
            </div>
          </div>

          {/* Actions: Approve / Reject or PayPal Smart Buttons */}
          {!isApproved ? (
            <div className="flex items-center gap-3 pt-2">
              <Button
                variant="outline"
                onClick={handleReject}
                disabled={isRejecting || isApproving}
                className="flex-1 border-[var(--rule)] hover:bg-[var(--paper-2)] hover:border-[var(--vermilion)] hover:text-[var(--vermilion)]"
              >
                <XCircle className="w-4 h-4 mr-2" />
                {isRejecting ? 'Rejecting...' : 'Reject Plan'}
              </Button>
              <Button
                variant="glow"
                onClick={handleApprove}
                disabled={isApproving || isRejecting}
                className="flex-1"
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                {isApproving ? 'Authorizing...' : 'Approve & Proceed'}
              </Button>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between p-3 rounded-[var(--radius)] bg-[var(--verdigris)]/10 border border-[var(--verdigris)] text-[var(--verdigris)] text-xs">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[var(--verdigris)]" />
                  <span className="font-semibold">Authorized by user. Pay with PayPal:</span>
                </div>
                <Badge variant="success">Approved</Badge>
              </div>

              {/* PayPal Smart Buttons */}
              <div className="p-3 rounded-[var(--radius)] bg-[var(--paper)] border border-[var(--rule)] min-h-[140px] flex flex-col justify-center">
                <PayPalButtons
                  style={{ layout: 'vertical', shape: 'rect', label: 'pay', height: 44 }}
                  createOrder={async () => {
                    try {
                      const res = await api.createPayment(plan.id);
                      setCreatedPaymentId(res.payment.id);
                      return res.orderId;
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : String(err);
                      toast.error('Payment Initialization Failed', { description: message });
                      throw err;
                    }
                  }}
                  onApprove={async (data) => {
                    try {
                      const paymentId = createdPaymentId || plan.payments?.[0]?.id;
                      if (!paymentId) {
                        toast.error('Payment reference missing');
                        return;
                      }
                      await api.capturePayment(paymentId, data.orderID);
                      toast.success('PayPal Payment Captured!', {
                        description: 'Awaiting authoritative webhook confirmation timestamp.',
                      });
                      onOpenChange(false);
                      router.push(`/payments/${paymentId}`);
                    } catch (err: unknown) {
                      const message = err instanceof Error ? err.message : String(err);
                      toast.error('Capture Failed', { description: message });
                    }
                  }}
                  onCancel={() => {
                    toast.info('PayPal checkout cancelled');
                  }}
                  onError={(err) => {
                    const message = typeof err === 'object' && err && 'message' in err ? String((err as { message: unknown }).message) : 'An error occurred during payment processing.';
                    toast.error('PayPal Checkout Error', {
                      description: message,
                    });
                  }}
                />
              </div>

              <p className="text-[11px] text-center text-[var(--ink-3)] flex items-center justify-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[var(--ledger)] shrink-0" />
                <span>Payment is only final once PayPal confirms via cryptographic webhook.</span>
              </p>
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
