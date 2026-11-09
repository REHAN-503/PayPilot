import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { z } from 'zod';
import { PlansService } from './plans.service.js';
import { PaymentsService } from '../payments/payments.service.js';

const selectAlternativeSchema = z.object({
  productId: z.string().min(1),
});

const whatIfSchema = z.object({
  maxBudget: z.number().positive().optional(),
  quantity: z.number().int().positive().optional(),
});

const decisionNoteSchema = z.object({
  note: z.string().optional(),
});

@Controller('plans')
export class PlansController {
  constructor(
    private readonly plansService: PlansService,
    private readonly paymentsService: PaymentsService,
  ) {}

  @Get()
  findAll(@Session() session: UserSession) {
    return this.plansService.findAll(session.user.id);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.plansService.findOne(session.user.id, id);
  }

  @Post(':id/pay')
  pay(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.paymentsService.createPaymentOrder(session.user.id, id);
  }

  @Post(':id/evaluate')
  evaluate(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.plansService.evaluatePlan(session.user.id, id);
  }

  @Post(':id/approve')
  approve(
    @Param('id') id: string,
    @Session() session: UserSession,
    @Body() body: unknown,
  ) {
    const parsed = decisionNoteSchema.safeParse(body ?? {});
    return this.plansService.approvePlan(
      session.user.id,
      id,
      parsed.success ? parsed.data.note : undefined,
    );
  }

  @Post(':id/reject')
  reject(
    @Param('id') id: string,
    @Session() session: UserSession,
    @Body() body: unknown,
  ) {
    const parsed = decisionNoteSchema.safeParse(body ?? {});
    return this.plansService.rejectPlan(
      session.user.id,
      id,
      parsed.success ? parsed.data.note : undefined,
    );
  }

  @Patch(':id/alternative')
  selectAlternative(
    @Param('id') id: string,
    @Session() session: UserSession,
    @Body() body: unknown,
  ) {
    const parsed = selectAlternativeSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid request body',
        errors: parsed.error.issues,
      });
    }

    return this.plansService.selectAlternative(
      session.user.id,
      id,
      parsed.data.productId,
    );
  }

  @Post(':id/what-if')
  whatIf(
    @Param('id') id: string,
    @Session() session: UserSession,
    @Body() body: unknown,
    @Query('commit') commit?: string,
  ) {
    const parsed = whatIfSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid what-if parameters',
        errors: parsed.error.issues,
      });
    }

    return this.plansService.whatIf(
      session.user.id,
      id,
      parsed.data,
      commit === 'true',
    );
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.plansService.cancelPlan(session.user.id, id);
  }
}
