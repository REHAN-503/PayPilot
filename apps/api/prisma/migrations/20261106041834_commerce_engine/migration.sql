-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'OUT_OF_STOCK', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "IntentStatus" AS ENUM ('DRAFT', 'PROCESSING', 'PLANNED', 'AWAITING_APPROVAL', 'APPROVED', 'EXECUTING', 'COMPLETED', 'REJECTED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'READY', 'AWAITING_APPROVAL', 'APPROVED', 'EXECUTING', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "AutonomyMode" AS ENUM ('ASK_EVERY_TIME', 'AUTO_WITHIN_LIMITS', 'MANUAL_APPROVAL');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'REVOKED');

-- CreateEnum
CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('CREATED', 'PENDING_APPROVAL', 'APPROVED', 'ORDER_CREATED', 'PAYER_ACTION_REQUIRED', 'CAPTURE_PENDING', 'CAPTURED', 'FAILED', 'CANCELLED', 'REFUNDED', 'PARTIALLY_REFUNDED', 'REVERSED');

-- CreateEnum
CREATE TYPE "LedgerEntryType" AS ENUM ('PAYMENT_AUTHORIZED', 'PAYMENT_CAPTURED', 'PAYMENT_FAILED', 'REFUND', 'PARTIAL_REFUND', 'REVERSAL', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "WebhookStatus" AS ENUM ('RECEIVED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED');

-- CreateEnum
CREATE TYPE "AgentActivityType" AS ENUM ('INTENT_CREATED', 'INTENT_ANALYZED', 'PRODUCT_SEARCHED', 'PRODUCT_SELECTED', 'PLAN_CREATED', 'PLAN_REVISED', 'POLICY_CHECKED', 'RISK_ASSESSED', 'APPROVAL_REQUESTED', 'APPROVAL_GRANTED', 'APPROVAL_REJECTED', 'PAYMENT_CREATED', 'PAYMENT_CAPTURED', 'PAYMENT_FAILED', 'WEBHOOK_RECEIVED', 'BUDGET_REPLANNED', 'AGENT_NEGOTIATED', 'SYSTEM_EVENT');

-- CreateTable
CREATE TABLE "user_policy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "autonomyMode" "AutonomyMode" NOT NULL DEFAULT 'ASK_EVERY_TIME',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "maxTransactionAmount" DECIMAL(12,2),
    "dailySpendingLimit" DECIMAL(12,2),
    "monthlySpendingLimit" DECIMAL(12,2),
    "requireApprovalAbove" DECIMAL(12,2),
    "allowAutoExecute" BOOLEAN NOT NULL DEFAULT false,
    "allowNegotiation" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_policy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "price" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "stock" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "productUrl" TEXT,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_intent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rawInput" TEXT NOT NULL,
    "interpretedGoal" TEXT,
    "category" TEXT,
    "minBudget" DECIMAL(12,2),
    "maxBudget" DECIMAL(12,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "preferences" JSONB,
    "constraints" JSONB,
    "status" "IntentStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_intent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_plan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "tax" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shipping" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "discount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "explanation" TEXT,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "plan_item" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productSku" TEXT,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "plan_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "decisionNote" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "risk_assessment" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "level" "RiskLevel" NOT NULL,
    "score" INTEGER NOT NULL,
    "reasons" JSONB NOT NULL,
    "recommendations" JSONB,
    "policyPassed" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "risk_assessment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'CREATED',
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paypalOrderId" TEXT,
    "paypalCaptureId" TEXT,
    "paypalPayerId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "failureCode" TEXT,
    "failureMessage" TEXT,
    "approvedAt" TIMESTAMP(3),
    "capturedAt" TIMESTAMP(3),
    "refundedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "type" "LedgerEntryType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "externalReference" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webhook_event" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "resourceId" TEXT,
    "status" "WebhookStatus" NOT NULL DEFAULT 'RECEIVED',
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "failureReason" TEXT,

    CONSTRAINT "webhook_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_activity" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "intentId" TEXT,
    "planId" TEXT,
    "paymentId" TEXT,
    "type" "AgentActivityType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_policy_userId_key" ON "user_policy"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "product_sku_key" ON "product"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "product_slug_key" ON "product"("slug");

-- CreateIndex
CREATE INDEX "product_category_idx" ON "product"("category");

-- CreateIndex
CREATE INDEX "product_status_idx" ON "product"("status");

-- CreateIndex
CREATE INDEX "product_name_idx" ON "product"("name");

-- CreateIndex
CREATE INDEX "purchase_intent_userId_createdAt_idx" ON "purchase_intent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_intent_status_idx" ON "purchase_intent"("status");

-- CreateIndex
CREATE INDEX "purchase_plan_userId_createdAt_idx" ON "purchase_plan"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "purchase_plan_status_idx" ON "purchase_plan"("status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_plan_intentId_version_key" ON "purchase_plan"("intentId", "version");

-- CreateIndex
CREATE INDEX "plan_item_planId_idx" ON "plan_item"("planId");

-- CreateIndex
CREATE INDEX "plan_item_productId_idx" ON "plan_item"("productId");

-- CreateIndex
CREATE INDEX "approval_userId_status_idx" ON "approval"("userId", "status");

-- CreateIndex
CREATE INDEX "approval_planId_idx" ON "approval"("planId");

-- CreateIndex
CREATE INDEX "risk_assessment_planId_createdAt_idx" ON "risk_assessment"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "risk_assessment_level_idx" ON "risk_assessment"("level");

-- CreateIndex
CREATE UNIQUE INDEX "payment_paypalOrderId_key" ON "payment"("paypalOrderId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_paypalCaptureId_key" ON "payment"("paypalCaptureId");

-- CreateIndex
CREATE UNIQUE INDEX "payment_idempotencyKey_key" ON "payment"("idempotencyKey");

-- CreateIndex
CREATE INDEX "payment_userId_createdAt_idx" ON "payment"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "payment_planId_idx" ON "payment"("planId");

-- CreateIndex
CREATE INDEX "payment_status_idx" ON "payment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "transaction_idempotencyKey_key" ON "transaction"("idempotencyKey");

-- CreateIndex
CREATE INDEX "transaction_userId_createdAt_idx" ON "transaction"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "transaction_paymentId_createdAt_idx" ON "transaction"("paymentId", "createdAt");

-- CreateIndex
CREATE INDEX "transaction_type_idx" ON "transaction"("type");

-- CreateIndex
CREATE UNIQUE INDEX "webhook_event_eventId_key" ON "webhook_event"("eventId");

-- CreateIndex
CREATE INDEX "webhook_event_eventType_receivedAt_idx" ON "webhook_event"("eventType", "receivedAt");

-- CreateIndex
CREATE INDEX "webhook_event_status_idx" ON "webhook_event"("status");

-- CreateIndex
CREATE INDEX "agent_activity_userId_createdAt_idx" ON "agent_activity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "agent_activity_intentId_idx" ON "agent_activity"("intentId");

-- CreateIndex
CREATE INDEX "agent_activity_planId_idx" ON "agent_activity"("planId");

-- CreateIndex
CREATE INDEX "agent_activity_paymentId_idx" ON "agent_activity"("paymentId");

-- CreateIndex
CREATE INDEX "agent_activity_type_idx" ON "agent_activity"("type");

-- AddForeignKey
ALTER TABLE "user_policy" ADD CONSTRAINT "user_policy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_intent" ADD CONSTRAINT "purchase_intent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_plan" ADD CONSTRAINT "purchase_plan_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_plan" ADD CONSTRAINT "purchase_plan_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "purchase_intent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_item" ADD CONSTRAINT "plan_item_planId_fkey" FOREIGN KEY ("planId") REFERENCES "purchase_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "plan_item" ADD CONSTRAINT "plan_item_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval" ADD CONSTRAINT "approval_planId_fkey" FOREIGN KEY ("planId") REFERENCES "purchase_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "risk_assessment" ADD CONSTRAINT "risk_assessment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "purchase_plan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_planId_fkey" FOREIGN KEY ("planId") REFERENCES "purchase_plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction" ADD CONSTRAINT "transaction_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_activity" ADD CONSTRAINT "agent_activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_activity" ADD CONSTRAINT "agent_activity_intentId_fkey" FOREIGN KEY ("intentId") REFERENCES "purchase_intent"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_activity" ADD CONSTRAINT "agent_activity_planId_fkey" FOREIGN KEY ("planId") REFERENCES "purchase_plan"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_activity" ADD CONSTRAINT "agent_activity_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
