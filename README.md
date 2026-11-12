# PayPilot ⚡

> **Autonomous, Policy-Governed Commerce Agent with Cryptographic PayPal Settlement**  
> *Built for the PayPal AI Hackathon (Devpost)*

[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16_App_Router-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19-cyan?style=flat-square&logo=react)](https://react.dev/)
[![NestJS](https://img.shields.io/badge/NestJS-12-red?style=flat-square&logo=nestjs)](https://nestjs.com/)
[![PayPal Orders v2](https://img.shields.io/badge/PayPal-Orders_v2_REST-003087?style=flat-square&logo=paypal)](https://developer.paypal.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

---

## 🎯 Problem & Solution

### The Problem
Autonomous AI agents are transitioning from conversation to real-world tool execution. However, when AI agents interact with financial rails, existing prototypes either:
1. **Rely on Fragile Prompts**: Asking an LLM *"Is this safe to buy?"*, which is easily bypassed through prompt injection.
2. **Grant Unbounded Financial Authority**: Giving agents direct API credentials with no deterministic spending caps, risking runaway loops.
3. **Lack Verifiable Auditability**: Storing payment records without immutable transaction ledgers or cryptographic proof of settlement.

### The Solution: PayPilot
PayPilot enforces a strict architectural boundary between **stochastic generative intelligence** and **deterministic financial execution**:

$$\text{\bf User Intent} \longrightarrow \text{\bf AI Planning} \longrightarrow \text{\bf Deterministic Policy Guard} \longrightarrow \text{\bf Human Authorization} \longrightarrow \text{\bf PayPal Orders v2} \longrightarrow \text{\bf Webhook Verification} \longrightarrow \text{\bf Immutable Ledger}$$

- The LLM **never touches credentials**, **never moves money**, and **cannot bypass policy limits**.
- Hard spending limits, velocity checks, and risk gates are pure TypeScript functions with deterministic, heavily-tested behaviour.
- Payments only settle once **PayPal's cryptographic webhook signature** is received and verified.

---

## ✨ Key Features

1. **Autonomous Procurement Planning**: Converts freeform goals into structured, itemized `PurchasePlan` candidates with spec tradeoff explanations.
2. **Deterministic Policy Engine & Budget Guard**: Enforces per-transaction caps, daily/monthly budgets, currency matching (`USD`), and category routing.
3. **Autonomous Budget Re-Planning**: When a preferred item exceeds limits (e.g., $289 monitor against a $250 limit), the agent automatically identifies the best compliant substitution (e.g., PixelView 24" at $229.99), explaining exact trade-offs.
4. **Behavioral Risk Gate**: Multi-signal scoring engine (0–100) evaluating budget consumption, merchant trust, catalog scarcity, recent payment velocity, and basket size.
5. **Interactive Approval Sheet**: Mobile-friendly bottom drawer featuring a rule-by-rule policy compliance checklist, risk chip, and official `@paypal/react-paypal-js` Smart Buttons.
6. **Buyer ↔ Merchant Autonomous Negotiation**: Multi-round concession game between buyer and merchant agents. Enforces strict buyer ceilings and secret server-side merchant reserve floors.
7. **PayPal Orders v2 & Webhook Verification**: Idempotent order creation (`PayPal-Request-Id`), capture tracking, and authoritative signature verification via PayPal's REST API.
8. **Verifiable Trust Timeline**: Real-time event stream (`/api/timeline/stream`) tracking every decision node with inspectable raw JSON evidence.
9. **Demo and Sandbox Modes**: Uses fixture-backed example prompts and mocked PayPal orders for demos; can call an LLM provider and PayPal Sandbox when credentials are configured.

---

## 🏗️ System Architecture

```mermaid
flowchart TD
    User([👤 User / Procurement Officer]) -->|Goal / Prompt| Web[🖥️ Next.js 16 Web App]
    Web -->|Rewrite Proxy /api/*| API[⚙️ NestJS 12 Gateway]
    
    subgraph Intelligence ["🧠 Stochastic Intelligence (Advisory Only)"]
        API --> IntentParser[Intent Parser]
        IntentParser --> CatalogEngine[Catalog Ranking & Tradeoffs]
        CatalogEngine --> Negotiation[Multi-Agent Negotiation]
    end

    subgraph Governance ["🛡️ Deterministic Governance (Strict Execution Guard)"]
        CatalogEngine --> PolicyEngine{Policy Engine\nHard Limits}
        PolicyEngine --> RiskGate{Risk Gate\nMulti-Signal 0-100}
        RiskGate -- "Blocked by Budget" --> Replan[Auto-Replan Loop\nMax 2 Iterations]
        Replan --> CatalogEngine
        PolicyEngine -- "Require Approval" --> ApprovalSheet[Interactive Approval Sheet]
    end

    subgraph Payments ["💳 Cryptographic PayPal Rails"]
        ApprovalSheet -->|User Authorized| PayClient[PayPal Client v2]
        PayClient -->|POST /v2/checkout/orders| PayPalSandbox[(PayPal Sandbox API)]
        PayPalSandbox -->|Client Approval| SmartButtons[PayPal Smart Buttons]
        SmartButtons -->|Capture| PayClient
        PayPalSandbox -.->|Signed Webhook| WebhookReceiver[Webhook Controller]
        WebhookReceiver -->|Verify Signature| PayPalSandbox
    end

    subgraph Ledger ["🔒 Tamper-Proof Audit"]
        WebhookReceiver -->|Idempotent Settle| TxLedger[(PostgreSQL Immutable Ledger)]
        TxLedger --> SSE[SSE Broadcast]
        SSE -->|Real-Time Append| Web
    end
```

---

## 🛠️ Technology Stack

| Component | Technology | Rationale |
|---|---|---|
| **Frontend** | Next.js 16 (App Router), React 19, Tailwind CSS v4 | Server Components, Proxy route protection, zero-CORS rewrites |
| **UI Primitives** | Radix UI, Framer Motion, Lucide Icons, Sonner | Responsive workspace UI with accessible controls |
| **Data Grids & Charts** | AG Grid Community v36, Recharts | High-performance sortable transaction ledgers and spend charts |
| **Backend Gateway** | NestJS 12, TypeScript (ESM) | Modular micro-architecture, dependency injection, strict validation |
| **Database & ORM** | PostgreSQL 16+, Prisma 7, `@prisma/adapter-pg` | Relational consistency, double-entry ledgers, unique event constraints |
| **Authentication** | Better Auth | Secure session cookies, route protection, 1-Click Demo login |
| **Payment Rails** | PayPal Orders v2 REST API + Webhooks | Idempotent order creation, Smart Buttons, cryptographic verification |
| **Validation & Testing** | Zod 4, Vitest 4, Playwright | Runtime schema validation, unit tests, and browser smoke tests |

---

## 💳 How PayPal is Used

PayPilot implements the modern PayPal Orders v2 and Webhooks architecture:

1. **Idempotent Order Creation (`POST /v2/checkout/orders`)**:
   - Initiated only after a `PurchasePlan` transitions to `APPROVED` and re-verifies policy constraints.
   - Generates structured `purchase_units` with full itemized breakdown (subtotal, tax, shipping, discount, item descriptions).
   - Transmits a unique `PayPal-Request-Id` derived from `hash(planId + approvalId)` to guarantee zero duplicate charges on network retries.
2. **Client-Side Authorization (`@paypal/react-paypal-js`)**:
   - PayPal Smart Buttons render dynamically inside the Approval Sheet once the user signs off on the policy checklist.
3. **Capture Execution (`POST /v2/checkout/orders/{id}/capture`)**:
   - Validates that the captured PayPal order ID matches the pending internal payment record. Transitions payment to `CAPTURE_PENDING`.
4. **Cryptographic Webhook Settlement (`POST /webhooks/paypal`)**:
   - PayPilot treats PayPal Webhooks as the **sole authoritative settlement trigger**.
   - Validates webhook authenticity using PayPal's `/v1/notifications/verify-webhook-signature` endpoint.
   - Dedupes incoming `event.id` values against a unique database table to safely ignore duplicate transmissions.

---

## 🤖 How AI is Used

PayPilot explicitly isolates generative intelligence to advisory roles:

1. **Intent Parsing**: Converts ambiguous natural language into structured JSON constraints (category, budget ceilings, priority weights).
2. **Catalog Tradeoff Generation**: Compares primary candidates against alternatives, extracting spec trade-offs (e.g., *"- $59.01, 24\" QHD instead of 27\" 4K"*).
3. **Multi-Agent Negotiation**: Simulates dynamic price discovery between a Buyer Agent and a Merchant Agent. The code enforces unbreachable buyer ceilings and secret merchant reserve floors, falling back to deterministic concession rules if LLM output exceeds bounds.

---

## 🔒 Security Model

- **Prompt Injection Immunity**: Governance policies (`maxTransactionAmount`, `dailySpendingLimit`) are stored in PostgreSQL and evaluated by pure TypeScript functions. An LLM prompt cannot alter spending limits.
- **Server-Side Floor Confidentiality**: The merchant's break-even reserve price is strictly isolated on the server and never sent to the buyer LLM or client bundle.
- **Secret Isolation**: PayPal Client Secrets and Better Auth keys are never exposed to the frontend. All client API communication passes through Next.js server rewrites.
- **Replay Protection**: Webhook event IDs are constrained by unique database indexes. Replayed events return HTTP 200 without executing secondary ledger mutations.

---

## 🚀 Quick Start

### Prerequisites

- Node.js 24 or newer (required by the workspace)
- pnpm 12.16.1 (the version in `package.json`)
- Docker with Compose, for local PostgreSQL

### 1. Create the app environment files

Run these commands from the repository root:

```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
```

The API reads `apps/api/.env`; the web app reads `apps/web/.env.local`. The root `.env.example` is a reference only. Do not put server secrets in the web environment file. Before starting, set a private `BETTER_AUTH_SECRET` of at least 32 characters in `apps/api/.env`. For a local demo, set `NEXT_PUBLIC_PAYPAL_CLIENT_ID=sb` in the web env file.

### 2. Start and prepare the database

```bash
pnpm install
pnpm db:up
pnpm db:migrate
pnpm db:seed
```

This starts PostgreSQL, applies the Prisma migrations, and seeds the demo user and product catalog. Keep Docker running while you use PayPilot.

### 3. Start the apps

```bash
pnpm dev
```

Open [http://localhost:3000/welcome](http://localhost:3000/welcome) and select **Launch Demo**. The API runs on port `4000`; the web app runs on port `3000`.

If you prefer separate terminals, run `pnpm --filter api start:dev` and `pnpm --filter web dev` from the repository root.

### Demo login

The seeded account is:

| Email | Password |
|---|---|
| `demo@paypilot.dev` | `Password123!` |

You can also use the **Launch Demo** button to sign in without entering the credentials.

## ⚙️ Demo, OpenRouter, and PayPal Sandbox modes

PayPilot has separate switches for AI provider calls and PayPal behavior. `DEMO_MODE` permits mocked PayPal behavior when valid PayPal credentials are absent; `LLM_FORCE_LIVE` controls whether an AI provider call is required. This lets you exercise OpenRouter while keeping payments mocked.

### Demo mode (no provider key required for example prompts)

In `apps/api/.env`:

```env
DEMO_MODE=true
LLM_FORCE_LIVE=false
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=
LLM_MODEL=openai/gpt-4o-mini
```

The built-in example prompts use deterministic fixtures, so the demo does not depend on an LLM provider. Without an API key, arbitrary prompts may not be supported. PayPal orders use the local mock when demo mode is on and valid PayPal credentials are not configured. If valid PayPal Sandbox credentials are present, the app calls that Sandbox account. To use the webhook simulator during local development, set `ENABLE_WEBHOOK_SIMULATOR=true`.

### Live OpenRouter AI with mocked payments

Add your key to **`apps/api/.env`** only; do not put it in `apps/web/.env.local` or expose it in frontend code. Then use:

```env
DEMO_MODE=true
LLM_FORCE_LIVE=true
LLM_PROVIDER=openrouter
OPENROUTER_API_KEY=your_openrouter_api_key
LLM_MODEL=openai/gpt-4o-mini
```

`LLM_MODEL` must be an OpenRouter model ID in `provider/model` form. Restart the API after changing its environment. `DEMO_MODE=true` still allows mock PayPal checkout when valid PayPal credentials are absent. For a mock-payment test, leave PayPal credentials unset or at their example placeholders; keep the OpenRouter key only in the API env file.

You can instead set `LLM_PROVIDER=gemini` with `GEMINI_API_KEY` or `LLM_PROVIDER=anthropic` with `ANTHROPIC_API_KEY`. Use a model ID supported by that provider.

### PayPal Sandbox checkout

For checkout against PayPal Sandbox, configure `DEMO_MODE=false`, keep `PAYPAL_API_BASE_URL=https://api-m.sandbox.paypal.com`, and provide the Sandbox app credentials and webhook ID in `apps/api/.env`. Set `LLM_FORCE_LIVE=true` and configure one LLM provider as well, because non-demo mode requires a live LLM. In `apps/web/.env.local`, set `NEXT_PUBLIC_PAYPAL_CLIENT_ID` to the client ID for the same Sandbox app. Follow [the PayPal setup guide](docs/PAYPAL_SETUP.md) to create the app and register its webhook.

This setup uses PayPal Sandbox. Production PayPal credentials and production money movement are outside this local development guide.

### Check app configuration

With the API running, open [http://localhost:4000/health](http://localhost:4000/health) to check API availability and [http://localhost:4000/health/config](http://localhost:4000/health/config) to view non-secret mode indicators.

## 🔧 Environment variables

### API: `apps/api/.env`

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_URL` | API origin, usually `http://localhost:4000` |
| `BETTER_AUTH_SECRET` | Secret used to sign authentication sessions (32+ characters) |
| `DEMO_MODE` | `true` permits PayPal mock behavior when valid PayPal credentials are absent; `false` requires configured PayPal credentials |
| `LLM_FORCE_LIVE` | `true` requires a provider call, including for built-in example prompts |
| `LLM_PROVIDER` | `openrouter`, `gemini`, or `anthropic` |
| `LLM_MODEL` | Provider model ID; OpenRouter IDs use `provider/model` form |
| `OPENROUTER_API_KEY` | OpenRouter key; keep this in the API env file only |
| `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` | Alternative provider keys, depending on `LLM_PROVIDER` |
| `PAYPAL_API_BASE_URL` | Use the Sandbox endpoint for local checkout testing |
| `PAYPAL_CLIENT_ID` / `PAYPAL_CLIENT_SECRET` | PayPal app credentials for the configured environment |
| `PAYPAL_WEBHOOK_ID` | Webhook ID registered for the PayPal app |
| `PAYPAL_CURRENCY` | Currency used for PayPal orders (defaults to `USD`) |
| `ENABLE_WEBHOOK_SIMULATOR` | Set `true` to enable the dev simulator outside production |
| `PORT` / `WEB_ORIGIN` | API port and allowed web origins |
| `DEMO_USER_PASSWORD` | Password for the seeded demo account |

### Web: `apps/web/.env.local`

| Variable | Purpose |
|---|---|
| `NEXT_PUBLIC_API_URL` | API origin, usually `http://localhost:4000` |
| `NEXT_PUBLIC_PAYPAL_CLIENT_ID` | PayPal client ID used by the browser SDK (`sb` for the local demo, or the matching Sandbox app ID for Sandbox checkout) |
| `NEXT_PUBLIC_PAYPAL_CURRENCY` | Currency displayed by the browser SDK, usually `USD` |

Only values intended for browser use belong in `NEXT_PUBLIC_*` variables. Never place OpenRouter, PayPal secret, or Better Auth secret keys there.

## 🧪 Checks

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:e2e
```

`pnpm test:e2e` expects the API, database, and web app configuration to be available. For a quick API availability check, run `pnpm smoke` while the API is running.

## 🌐 PayPal Sandbox Setup & Webhooks

For live testing with real PayPal Sandbox accounts, follow our detailed guide:
👉 **[Read the PayPal setup guide](docs/PAYPAL_SETUP.md)**

### Running Without PayPal Keys (`DEMO_MODE=true`)
If you do not have PayPal developer credentials, keep `DEMO_MODE=true` in `apps/api/.env`. PayPilot will:
1. Provide mock PayPal orders and mock capture IDs.
2. Let you enable the **Dev Webhook Simulator** by setting `ENABLE_WEBHOOK_SIMULATOR=true` in `apps/api/.env`; it can simulate `COMPLETED`, `DENIED`, `REVERSED`, and duplicate webhook events during local development.

---

## 📁 Project Structure

```
paypilot/
├── apps/
│   ├── api/                    # NestJS 12 Gateway
│   │   ├── src/
│   │   │   ├── agent/          # Procurement planning & catalog ranking
│   │   │   ├── policy/         # Pure deterministic policy & risk gate
│   │   │   ├── replan/         # Autonomous budget re-planning engine
│   │   │   ├── negotiation/    # Multi-agent bargaining protocol
│   │   │   ├── paypal/         # PayPal Orders v2 REST client
│   │   │   ├── payments/       # Payment state machine & capture
│   │   │   ├── webhooks/       # Cryptographic webhook signature verifier
│   │   │   └── timeline/       # SSE streaming audit ledger
│   │   └── prisma/             # Schema, migrations, and product seed data
│   │
│   └── web/                    # Next.js 16 Frontend (React 19)
│       ├── src/
│       │   ├── app/            # App Router pages (9 screens)
│       │   ├── components/     # UI primitives, live agent panel, approval sheet
│       │   ├── hooks/          # useEventStream (SSE connection)
│       │   ├── lib/            # Typed API client, Zod schemas, Better Auth
│       │   └── proxy.ts        # Next 16 route protection proxy
│       └── tests/              # Playwright desktop and mobile smoke tests
│
├── docs/                       # Architecture, Security, API, and PayPal setup docs
├── postman/                    # Postman collection & sandbox environment
├── docker-compose.yml          # Local PostgreSQL container definition
└── render.yaml                 # Production deployment blueprint
```

---

## ⚠️ Limitations & Future Work

PayPilot was built as an exploration of autonomous agent governance for the PayPal AI Hackathon:
- **Sandbox Only**: Built and validated strictly against PayPal Sandbox. It is **not** audited or certified for unmonitored production money movement.
- **Simulated Catalog**: Products are currently sourced from an internal seeded catalog rather than live third-party merchant APIs.
- **Single-Merchant Carts**: Multi-item plans currently assume fulfillment through a single merchant checkout session. Future work includes multi-merchant split orders and automated recurring subscription renegotiation.

---

## 📄 License
This project is open-source under the [MIT License](LICENSE).
