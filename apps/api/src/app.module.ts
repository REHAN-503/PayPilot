import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { AuthModule } from './auth/auth.module.js';
import { ProductsModule } from './products/products.module.js';
import { IntentsModule } from './intents/intents.module.js';
import { PoliciesModule } from './policies/policies.module.js';
import { PlansModule } from './plans/plans.module.js';
import { ApprovalsModule } from './approvals/approvals.module.js';
import { PaymentsModule } from './payments/payments.module.js';
import { WebhooksModule } from './webhooks/webhooks.module.js';
import { LedgerModule } from './ledger/ledger.module.js';
import { AgentModule } from './agent/agent.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    PrismaModule,
    AuthModule,
    AgentModule,
    ProductsModule,
    IntentsModule,
    PoliciesModule,
    PlansModule,
    ApprovalsModule,
    PaymentsModule,
    WebhooksModule,
    LedgerModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
