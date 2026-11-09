-- CreateEnum
CREATE TYPE "NegotiationStatus" AS ENUM ('IN_PROGRESS', 'AGREED', 'FAILED', 'REJECTED');

-- CreateEnum
CREATE TYPE "NegotiationParty" AS ENUM ('BUYER', 'MERCHANT');

-- AlterEnum
ALTER TYPE "AgentActivityType" ADD VALUE 'NEGOTIATION_ROUND';

-- AlterTable
ALTER TABLE "product" ADD COLUMN     "minPrice" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "user_policy" ADD COLUMN     "negotiationMaxRounds" INTEGER NOT NULL DEFAULT 3;

-- CreateTable
CREATE TABLE "negotiation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "NegotiationStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "initialPrice" DECIMAL(12,2) NOT NULL,
    "agreedPrice" DECIMAL(12,2),
    "buyerCeiling" DECIMAL(12,2) NOT NULL,
    "merchantFloor" DECIMAL(12,2),
    "roundsCount" INTEGER NOT NULL DEFAULT 0,
    "maxRounds" INTEGER NOT NULL DEFAULT 3,
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "negotiation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "negotiation_round" (
    "id" TEXT NOT NULL,
    "negotiationId" TEXT NOT NULL,
    "roundNumber" INTEGER NOT NULL,
    "speaker" "NegotiationParty" NOT NULL,
    "action" TEXT NOT NULL,
    "price" DECIMAL(12,2) NOT NULL,
    "rationale" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "negotiation_round_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "negotiation_userId_createdAt_idx" ON "negotiation"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "negotiation_planId_idx" ON "negotiation"("planId");

-- CreateIndex
CREATE INDEX "negotiation_round_negotiationId_roundNumber_idx" ON "negotiation_round"("negotiationId", "roundNumber");

-- AddForeignKey
ALTER TABLE "negotiation" ADD CONSTRAINT "negotiation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation" ADD CONSTRAINT "negotiation_planId_fkey" FOREIGN KEY ("planId") REFERENCES "purchase_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "negotiation_round" ADD CONSTRAINT "negotiation_round_negotiationId_fkey" FOREIGN KEY ("negotiationId") REFERENCES "negotiation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
