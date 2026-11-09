import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Put,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { z } from 'zod';
import { PoliciesService } from './policies.service.js';

const updatePolicySchema = z.object({
  autonomyMode: z.enum(['ASK_EVERY_TIME', 'AUTO_WITHIN_LIMITS', 'MANUAL_APPROVAL']).optional(),
  maxTransactionAmount: z.number().positive().max(100000).nullable().optional(),
  dailySpendingLimit: z.number().positive().max(100000).nullable().optional(),
  monthlySpendingLimit: z.number().positive().max(100000).nullable().optional(),
  requireApprovalAbove: z.number().positive().max(100000).nullable().optional(),
  allowAutoExecute: z.boolean().optional(),
  allowNegotiation: z.boolean().optional(),
});

@Controller('policies')
export class PoliciesController {
  constructor(private readonly policiesService: PoliciesService) {}

  @Get('me')
  getPolicy(@Session() session: UserSession) {
    return this.policiesService.getPolicy(session.user.id);
  }

  @Put('me')
  updatePolicy(
    @Session() session: UserSession,
    @Body() body: unknown,
  ) {
    const parsed = updatePolicySchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid policy payload',
        errors: parsed.error.issues,
      });
    }

    return this.policiesService.updatePolicy(session.user.id, parsed.data);
  }
}

