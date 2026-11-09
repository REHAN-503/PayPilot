-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AgentActivityType" ADD VALUE 'POLICY_BLOCKED';
ALTER TYPE "AgentActivityType" ADD VALUE 'FORBIDDEN_ACTION_BLOCKED';

-- AlterTable
ALTER TABLE "agent_activity" ADD COLUMN     "actor" TEXT NOT NULL DEFAULT 'AGENT';

-- AlterTable
ALTER TABLE "purchase_plan" ADD COLUMN     "alternatives" JSONB,
ADD COLUMN     "tradeoffs" JSONB;
