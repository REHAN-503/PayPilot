import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { AllowAnonymous } from '@thallesp/nestjs-better-auth';
import { WebhooksService } from './webhooks.service.js';

@Controller('webhooks')
@AllowAnonymous()
export class WebhooksController {
  constructor(private readonly webhooksService: WebhooksService) {}

  @Post('paypal')
  @HttpCode(HttpStatus.OK)
  handlePayPalWebhook(
    @Headers('paypal-auth-algo') authAlgo: string | undefined,
    @Headers('paypal-cert-url') certUrl: string | undefined,
    @Headers('paypal-transmission-id') transmissionId: string | undefined,
    @Headers('paypal-transmission-sig') transmissionSig: string | undefined,
    @Headers('paypal-transmission-time') transmissionTime: string | undefined,
    @Body() payload: any,
  ) {
    return this.webhooksService.handleWebhook(
      {
        authAlgo,
        certUrl,
        transmissionId,
        transmissionSig,
        transmissionTime,
      },
      payload,
    );
  }
}

