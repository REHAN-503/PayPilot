import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import type { PrismaService } from '../prisma/prisma.service.js';

interface AuthOptions {
  baseURL: string;
  secret: string;
}

export function createAuth(
  prisma: PrismaService,
  options: AuthOptions,
) {
  return betterAuth({
    baseURL: options.baseURL,
    secret: options.secret,

    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),

    emailAndPassword: {
      enabled: true,
    },

    trustedOrigins: [
      'http://localhost:3000',
    ],
  });
}
