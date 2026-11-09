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
  const configuredOrigins = (process.env.WEB_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const defaultDevOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const trustedOrigins = Array.from(new Set([...defaultDevOrigins, ...configuredOrigins]));

  return betterAuth({
    baseURL: options.baseURL,
    secret: options.secret,

    database: prismaAdapter(prisma, {
      provider: 'postgresql',
    }),

    emailAndPassword: {
      enabled: true,
    },

    trustedOrigins,
  });
}
