# PayPilot ⚡
> **Permissioned AI Commerce Agent for Explainable, Policy-Governed PayPal Payments**
> *Built for the PayPal AI Hackathon (Devpost)*

---

## 🎯 Executive Summary & Core Principle

**PayPilot** transforms natural-language purchase intent into a strictly governed, explainable, and cryptographically verifiable payment workflow. Unlike unconstrained AI purchasing assistants, PayPilot enforces strict mathematical separation between AI planning and financial execution:

$$\text{\bf AI Proposes} \longrightarrow \text{\bf Policy Engine Decides} \longrightarrow \text{\bf User Authorizes} \longrightarrow \text{\bf PayPal Executes} \longrightarrow \text{\bf Webhooks Verify} \longrightarrow \text{\bf Ledger Records}$$

### Non-Negotiable Guardrails
1. **The LLM Never Moves Money and Never Sees Secrets:** The model only generates structured, Zod-validated intent proposals. Payment initiation is isolated to backend services only when `plan.status === 'APPROVED'` and deterministic spending policies have passed.
2. **Server-Side Recomputed Pricing:** Client-provided prices and LLM-generated totals are rejected; all pricing, discounts, shipping, and totals are recomputed directly from authoritative PostgreSQL records.
3. **Pure-Function Policy & Risk Gating:** Hard spending limits (transaction ceilings, daily and monthly budget caps, approval thresholds) and multi-factor risk assessments are pure, unit-tested functions—never prompt-based.
4. **Authoritative Webhooks:** A frontend "success" page is never proof of payment. Only PayPal Webhooks (`PAYMENT.CAPTURE.COMPLETED`) or verified REST captures authoritatively settle transactions.
5. **PostgreSQL-Enforced Immutable Ledger:** Transaction ledger rows are append-only. A custom PostgreSQL trigger (`trg_transaction_immutable`) rejects any `UPDATE` or `DELETE` at the database engine level.
6. **Strict USD Currency:** All transactions, limits, and order line items are standardized in USD.
7. **Idempotency Everywhere:** Enforced via `PayPal-Request-Id` headers on orders/captures, unique `Payment.idempotencyKey`, and unique `WebhookEvent.eventId`.
8. **Offline Demo Mode (`DEMO_MODE=true`):** Built-in deterministic offline fallback engine allowing the full end-to-end commerce workflow to run without external API keys.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    User([👤 User / Human]) -->|Natural Language Intent| Frontend[🖥️ Next.js 16 Web App]
    Frontend -->|POST /intents| Backend[⚙️ NestJS 12 API]
    
    subgraph AI Planning & Policy Gating
        Backend -->|Prompt Sanitization| LLM[🧠 Intent Parser / LLM]
        LLM -->|Zod-Validated Intent| Catalog[(📦 Fictional Product Catalog)]
        Catalog -->|Authoritative Prices| PolicyEngine{🛡️ Deterministic Policy Engine}
        PolicyEngine -->|Currency, Caps, Velocity| RiskEngine{⚖️ Pure Risk Scoring Engine}
        RiskEngine -->|Audit Log| ActivityLedger[(📜 Agent Activity Trail)]
    end
    
    subgraph Authorization Boundary
        PolicyEngine -->|Mode: ASK_EVERY_TIME or Exceeds Threshold| ApprovalQueue[⏳ Pending Approval Queue]
        ApprovalQueue -->|Explicit Decision| User
        PolicyEngine -->|Mode: AUTO_WITHIN_LIMITS & Risk LOW| AutoApproved[✅ Auto-Approved Plan]
    end
    
    subgraph Execution & Settlement
        User -.->|Approve| AutoApproved
        AutoApproved -->|POST /payments/create-order| PayPalAPI[💳 PayPal Orders v2 API]
        PayPalAPI -->|ORDER_CREATED| UserModal[🔐 PayPal Sandbox Approval]
        UserModal -->|POST /payments/:id/capture| CaptureAPI[💰 PayPal Capture v2 API]
        PayPalAPI -.->|Async Webhook| WebhookHandler[🪝 PayPal Webhook Receiver]
    end
    
    subgraph Tamper-Proof Audit
        CaptureAPI -->|PAYMENT_CAPTURED| ImmutableLedger[(🔒 PostgreSQL Immutable Ledger)]
        WebhookHandler -->|Idempotent Settle| ImmutableLedger
        ImmutableLedger -.->|DB Trigger: No UPDATE/DELETE| Blocked[🚫 PG Trigger Exception]
    end
```

---

## 🛠️ Technology Stack

| Layer | Technology | Key Highlights |
|---|---|---|
| **Monorepo** | pnpm 12 + Turborepo 2 | Co-located `apps/api`, `apps/web`, shared caching & scripts |
| **Backend API** | NestJS 12 + TypeScript (ESM) | Modular domain architecture, Zod validation, `@prisma/adapter-pg` |
| **Database & ORM** | PostgreSQL 18 + Prisma 7 | Custom migrations, database triggers, 15 seeded fictional products |
| **Authentication** | Better Auth | Session cookies, secure registration, 1-Click Demo login |
| **Frontend** | Next.js 16 (App Router) + React 19 | Turbopack, Tailwind CSS 4, Lucide icons, responsive layout |
| **Payment Gateway** | PayPal REST API (Orders v2) | Sandbox integration, idempotency keys, webhook signature verification |
| **Code Quality** | Vitest 4 + Oxlint + ESLint 9 | 100% passing unit & e2e test suite, type-aware linting |

---

## 🚀 Quickstart Guide

### 1. Prerequisites
- **Node.js**: v20+ (Node.js 24 recommended via `mise` or `nvm`)
- **Package Manager**: `pnpm` (`npm install -g pnpm`)
- **Database**: PostgreSQL instance running on `localhost:5432`

### 2. Environment Configuration
Copy environment files from provided templates:
```bash
cp .env.example .env
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

Ensure `apps/api/.env` has your PostgreSQL connection string:
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/paypilot"
PORT=4000
BETTER_AUTH_SECRET="paypilot_super_secret_sandbox_key_2026_dev"
BETTER_AUTH_URL="http://localhost:4000"
DEMO_MODE=true
PAYPAL_MODE=sandbox
PAYPAL_API_BASE_URL=https://api-m.sandbox.paypal.com
```

### 3. Database Migration & Fictional Catalog Seed
Run database migrations (including the append-only ledger trigger) and seed the catalog:
```bash
# Apply Prisma migrations
pnpm --filter api prisma migrate deploy

# Seed 15 fictional products (AuraSound, SonicBuds, NovaView, ErgoFlow, etc.)
pnpm --filter api prisma db seed
```

### 4. Build and Run
Start both frontend and backend concurrently:
```bash
pnpm dev
```
Or run individual apps:
- **Backend API**: `pnpm --filter api start:dev` (runs on `http://localhost:4000`)
- **Frontend Web**: `pnpm --filter web dev` (runs on `http://localhost:3000`)

Open **`http://localhost:3000`** in your browser.

---

## 🧪 Testing & Verification

Run the entire test suite and typechecks across the monorepo:
```bash
# Typecheck both packages (tsc --noEmit)
pnpm typecheck

# Fast type-aware linting (oxlint on backend, eslint on frontend)
pnpm lint

# Run all 37 Vitest unit tests (state machine, policies, risk, intent parser, payments)
pnpm test

# Run backend end-to-end HTTP tests
pnpm --filter api test:e2e

# Run production build
pnpm build
```

---

## 🎬 Demo Walkthrough Script for Judges

### 1-Click Demo Login
Click **"Sign In"** in the top navigation and select **"1-Click Demo Login"** (`demo@paypilot.ai` / `password123`). This pre-configures your account with active policies and zero initial spend.

---

### Scenario A: Human-in-the-Loop Approval Flow (`ASK_EVERY_TIME`)
1. Click the **"Policy & Budget"** button in the header. Verify autonomy mode is set to **"Ask Every Time (Manual Approval)"**.
2. In the Agent Studio, enter natural language intent:
   > *"Find noise-cancelling headphones under $200"*
3. Observe the PayPilot agent:
   - Interprets natural language requirements and extracts category (`Electronics`), budget ceiling (`$200`), and preferences (`noise-cancelling`, `headphones`).
   - Recommends `ErgoFlow Precision Mouse 3S` or headphones from the catalog.
   - Computes deterministic spending policies and scores risk (`LOW`, 20/100).
   - Enters `AWAITING_APPROVAL` status because policy mandates explicit user consent.
   - Writes 7 explainable activity log steps to the audit trail.
4. **Alternative Item Swap:** Click the **"Swap Item"** button on an alternative product (e.g. `SonicBuds Pro 2 Wireless Earbuds` at `$189.99`). The total updates instantly with 100% server-side recalculation.
5. **Approve Plan:** Navigate to the **Approvals** tab or click **"Authorize Plan"**. Plan transitions to `APPROVED`.
6. **Execute Payment:** Click **"Pay with PayPal Sandbox"**. Order is created via PayPal Orders v2, and captured with an immutable transaction row created.

---

### Scenario B: Autonomous Pre-Authorized Flow (`AUTO_WITHIN_LIMITS`)
1. Open **"Policy & Budget"** modal:
   - Select **"Auto-Approve Within Limits"**.
   - Set **Approval Threshold** to `$50.00`.
   - Set **Max Transaction Limit** to `$100.00`.
   - Toggle **"Allow Agent Auto-Execution"** to **ON**.
   - Click **Save Spending Policy**.
2. In Agent Studio, submit a purchase under the threshold:
   > *"Find an ambient LED smart bulb under $30"*
3. Observe autonomous execution:
   - Matches `LuminaCore Smart Ambient LED Bulb` at `$24.99`.
   - Policy evaluates: `$24.99 <= $50.00` threshold, within daily & monthly budgets.
   - Status automatically transitions to `APPROVED` without requiring manual user intervention.
   - A single click on **"Execute Payment"** completes the transaction.

---

### Scenario C: Deterministic Policy Violation & Guardrail Protection
1. With Max Transaction Limit set to `$100.00`, submit an intent for an expensive item:
   > *"Find an air purifier under $200"*
2. Observe policy gating:
   - Matches `PureBreeze Smart Room Air Purifier` (`$179.99`).
   - Deterministic Policy Engine **flags violation**: *"Plan total of $179.99 exceeds maximum per-transaction limit of $100.00."*
   - Risk score elevates to **HIGH (65/100)**.
   - Even if forced in DB or UI, backend endpoint `POST /payments/create-order` explicitly blocks payment:
     ```json
     {
       "message": "Cannot initiate payment: purchase plan has unresolved policy violations.",
       "error": "Bad Request",
       "statusCode": 400
     }
     ```

---

### Scenario D: Tamper-Proof Audit & Immutable PostgreSQL Ledger
1. Navigate to the **Ledger** tab in the UI.
2. View the settled transactions with capture IDs, timestamps, and PayPal reference IDs.
3. Attempt to maliciously mutate or delete a transaction row via PostgreSQL CLI:
   ```bash
   psql "postgresql://postgres:postgres@localhost:5432/paypilot" -c "DELETE FROM transaction;"
   ```
4. Observe the database trigger preventing tamper:
   ```
   ERROR: Transaction ledger records are immutable and append-only. Modification or deletion is strictly prohibited
   ```

---

## 🔒 Security & Privacy Architecture

- **Prompt Injection Defense:** Strict input sanitization strips control characters and validates length; structured outputs are validated via Zod schemas.
- **Principle of Least Privilege:** LLM has zero knowledge of PayPal client secrets, Better Auth tokens, or customer bank details.
- **Multi-Tenant Ownership:** All database queries are scoped by `userId` extracted directly from verified Better Auth session tokens.
- **Safe Webhook Handling:** Webhook payloads are verified and deduplicated against the unique `WebhookEvent.eventId` in Postgres to prevent replay attacks.
- **Fictional Trademarks:** Seed data uses 100% original, fictional branding (e.g. *AuraSound, SonicBuds, NovaView, PortMatrix, KeyFlow*).

---

## 📄 License
MIT License. Created for the PayPal AI Hackathon 2026.
