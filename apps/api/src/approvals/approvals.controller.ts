import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { z } from 'zod';
import { ApprovalsService } from './approvals.service.js';

const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().max(500).optional(),
});

@Controller('approvals')
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get('pending')
  findPending(@Session() session: UserSession) {
    return this.approvalsService.findPending(session.user.id);
  }

  @Post(':id/decision')
  submitDecision(
    @Param('id') id: string,
    @Session() session: UserSession,
    @Body() body: unknown,
  ) {
    const parsed = decisionSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid decision payload',
        errors: parsed.error.issues,
      });
    }

    return this.approvalsService.submitDecision(
      session.user.id,
      id,
      parsed.data,
    );
  }
}

