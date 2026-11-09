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

const selectAlternativeSchema = z.object({
  productId: z.string().min(1),
});

const whatIfSchema = z.object({
  maxBudget: z.number().positive().optional(),
  quantity: z.number().int().positive().optional(),
});

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get(':id')
  findOne(
    @Param('id') id: string,
    @Session() session: UserSession,
  ) {
    return this.plansService.findOne(session.user.id, id);
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
