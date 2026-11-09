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
import { PaymentsService } from './payments.service.js';

const createOrderSchema = z.object({
  planId: z.string().min(1),
});

const captureSchema = z.object({
  orderId: z.string().optional(),
});

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(@Session() session: UserSession) {
    return this.paymentsService.findAll(session.user.id);
  }

  @Post('create-order')
  createOrder(
    @Session() session: UserSession,
    @Body() body: unknown,
  ) {
    const parsed = createOrderSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid planId',
        errors: parsed.error.issues,
      });
    }

    return this.paymentsService.createPaymentOrder(
      session.user.id,
      parsed.data.planId,
    );
  }

  @Post(':id/capture')
  capture(
    @Param('id') id: string,
    @Session() session: UserSession,
    @Body() body: unknown,
  ) {
    const parsed = captureSchema.safeParse(body ?? {});
    return this.paymentsService.capturePayment(
      session.user.id,
      id,
      parsed.success ? parsed.data.orderId : undefined,
    );
  }

  @Post(':id/cancel')
  cancel(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.paymentsService.cancelPayment(session.user.id, id);
  }

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.paymentsService.findOne(session.user.id, id);
  }
}

