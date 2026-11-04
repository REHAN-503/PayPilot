import { Controller, Get } from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';

@Controller()
export class AppController {
  @AllowAnonymous()
  @Get()
  getHealth() {
    return {
      status: 'ok',
      service: 'PayPilot API',
      timestamp: new Date().toISOString(),
    };
  }
}