import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Put,
} from '@nestjs/common';
import { Session, type UserSession } from '@thallesp/nestjs-better-auth';
import { PolicyService } from './policy.service.js';
import { policySimulationSchema, updatePolicySchema } from './policy.schema.js';

@Controller(['policy', 'policies'])
export class PolicyController {
  constructor(private readonly policyService: PolicyService) {}

  @Get(['', 'me'])
  getPolicy(@Session() session: UserSession) {
    return this.policyService.getPolicy(session.user.id);
  }

  @Put(['', 'me'])
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

    return this.policyService.updatePolicy(session.user.id, parsed.data);
  }

  @Post('simulate')
  simulate(@Session() session: UserSession, @Body() body: unknown) {
    const parsed = policySimulationSchema.safeParse(body);
    if (!parsed.success) {
      throw new BadRequestException({
        message: 'Invalid simulation payload',
        errors: parsed.error.issues,
      });
    }
    return this.policyService.simulate(session.user.id, parsed.data);
  }
}
