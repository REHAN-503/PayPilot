import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Enable NestJS built-in raw body parser.
    // This preserves req.rawBody as a Buffer on incoming requests (for PayPal webhook verification)
    // while keeping standard JSON body parsing intact for all API controllers.
    rawBody: true,
  });

  const configuredOrigins = (process.env.WEB_ORIGIN || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const defaultDevOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000'];
  const allowedOrigins = Array.from(new Set([...defaultDevOrigins, ...configuredOrigins]));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  });

  app.enableShutdownHooks();

  await app.listen(process.env.PORT ?? 4000);
}

await bootstrap();
