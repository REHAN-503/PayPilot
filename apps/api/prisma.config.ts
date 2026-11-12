import 'dotenv/config';
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    // Client generation does not connect to the database. Render may not expose
    // DATABASE_URL until runtime, so use a local placeholder during builds.
    url: process.env.DATABASE_URL ?? 'postgresql://localhost:5432/paypilot?schema=public',
  },
});
