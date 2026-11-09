-- AlterEnum
ALTER TYPE "AgentActivityType" ADD VALUE 'REPLAN_PROPOSED';

-- AlterTable
ALTER TABLE "user_policy" ADD COLUMN     "allowedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "autoApproveCategories" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "blockedCategories" TEXT[] DEFAULT ARRAY[]::TEXT[];
