import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule as BetterAuthModule } from '@thallesp/nestjs-better-auth';
import { PrismaModule } from '../prisma/prisma.module.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { createAuth } from './auth.js';

@Module({
  imports: [
    BetterAuthModule.forRootAsync({
      imports: [PrismaModule],
      inject: [PrismaService, ConfigService],
      useFactory: (
        prisma: PrismaService,
        config: ConfigService,
      ) => ({
        auth: createAuth(prisma, {
          baseURL: config.getOrThrow<string>('BETTER_AUTH_URL'),
          secret: config.getOrThrow<string>('BETTER_AUTH_SECRET'),
        }),
      }),
    }),
  ],
})
export class AuthModule {}
