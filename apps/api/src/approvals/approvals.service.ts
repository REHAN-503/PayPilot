import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import {
  transitionApprovalStatus,
  transitionIntentStatus,
  transitionPlanStatus,
} from '../common/state/state-machine.js';
import { PolicyService } from '../policy/policy.service.js';

export interface DecisionDto {
  decision: 'APPROVED' | 'REJECTED';
  note?: string;
}

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly policyService?: PolicyService,
  ) {}

  async findPending(userId: string) {
    return this.prisma.approval.findMany({
      where: {
        userId,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: {
          include: {
            items: true,
            riskAssessments: { orderBy: { createdAt: 'desc' }, take: 1 },
          },
        },
      },
    });
  }

  async submitDecision(userId: string, approvalId: string, dto: DecisionDto) {
    const approval = await this.prisma.approval.findFirst({
      where: { id: approvalId, userId },
      include: {
        plan: {
          include: { intent: true },
        },
      },
    });

    if (!approval) {
      throw new NotFoundException('Approval request not found');
    }
    await this.policyService?.assertAgentActive(userId, {
      planId: approval.planId,
      intentId: approval.plan.intentId,
    });

    if (approval.status !== 'PENDING') {
      throw new BadRequestException(
        `Approval has already been resolved with status '${approval.status}'.`,
      );
    }

    const { decision, note } = dto;
    const now = new Date();

    const targetApprovalStatus = transitionApprovalStatus(approval.status as any, decision);
    const targetPlanStatus = transitionPlanStatus(
      approval.plan.status as any,
      decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
    );
    const targetIntentStatus = transitionIntentStatus(
      approval.plan.intent.status as any,
      decision === 'APPROVED' ? 'APPROVED' : 'REJECTED',
    );

    return this.prisma.$transaction(async (tx) => {
      const updatedApproval = await tx.approval.update({
        where: { id: approvalId },
        data: {
          status: targetApprovalStatus,
          decisionNote: note ?? (decision === 'APPROVED' ? 'Approved by user.' : 'Rejected by user.'),
          ...(decision === 'APPROVED' ? { approvedAt: now } : { rejectedAt: now }),
        },
      });

      await tx.purchasePlan.update({
        where: { id: approval.planId },
        data: { status: targetPlanStatus },
      });

      await tx.purchaseIntent.update({
        where: { id: approval.plan.intentId },
        data: { status: targetIntentStatus },
      });

      await tx.agentActivity.create({
        data: {
          userId,
          intentId: approval.plan.intentId,
          planId: approval.planId,
          type: decision === 'APPROVED' ? 'APPROVAL_GRANTED' : 'APPROVAL_REJECTED',
          title: decision === 'APPROVED' ? 'Purchase plan authorized' : 'Purchase plan rejected',
          description: note || `User explicitly ${decision.toLowerCase()} the purchase plan.`,
          metadata: { decision, note },
        },
      });

      return updatedApproval;
    });
  }
}
