# PayPilot Phase 0 Audit

**Date:** 2026-11-11  
**Scope:** Read-only repository audit per master prompt  
**Evidence:** file paths and line numbers cited below

---

## A. AI Integration (Hackathon Criticality)

### Model calls identified

| # | Provider | Model (default/config) | Location | Purpose |
|---|----------|------------------------|----------|---------|
| 1 | Anthropic | `claude-sonnet-5-5` (default, configurable via `LLM_MODEL`) | `apps/api/src/agent/llm/llm.service.ts:52-76,260-320` | Intent parsing & plan ranking via `messages.create` with tool-use structured output |
| 2 | Gemini | Configurable via `LLM_MODEL` | `apps/api/src/agent/llm/llm.service.ts:52-76,200-258` | Intent parsing & plan ranking via REST `generateContent` |

**Call sites:**
- `apps/api/src/agent/intent-parser.ts:82-95` — `parseIntentWithLlm()` → `llmService.generateJson(IntentSchema, INTENT_PARSER_SYSTEM_PROMPT, delimitedUserPrompt, 'intent')`
- `apps/api/src/agent/planner.ts:90-170` — `rankAndPlanWithLlm()` → `llmService.generateJson(PlanRankingSchema, PLANNER_SYSTEM_PROMPT, userPrompt, 'planRanking')`
- `apps/api/src/negotiation/negotiation.service.ts:560-620` — `executeAgentStep()` → `llmService.generateJson(BuyerOfferSchema/MerchantOfferSchema, ...)` (buyer & merchant agents)

### Real AI vs deterministic

| Process | AI-driven? | Evidence |
|---------|------------|----------|
| Intent parsing | **Yes** — real LLM call when live mode + key configured | `intents.service.ts:108` calls `parseIntentWithLlm`; fallback to deterministic only on `LlmUnavailableError` when not `forceLive` (`intents.service.ts:113-140`) |
| Catalog ranking/planning | **Yes** — real LLM call | `intents.service.ts:316-330` calls `rankAndPlanWithLlm` with candidate products; server verifies IDs, rejects hallucinations (`planner.ts:72-90`) |
| Negotiation | **Partially** — LLM used when not demo mode, but deterministic fallback on any error | `negotiation.service.ts:560-620`: if `llmService.isDemoMode()` returns true → deterministic; otherwise attempts LLM per round with deterministic fallback on failure/malformed output |
| Re-planning | **No** — deterministic by design | `apps/api/src/replan/replan.service.ts:1-286` — rule-based budget substitution, no LLM calls |
| Policy gate | **No** — deterministic by design | `apps/api/src/policy/policy.engine.ts:1-218` — pure function evaluation |

### Submission blockers (AI)

1. **Gemini API key in URL query parameter** — `llm.service.ts:205-206`: `const url = ...?key=${this.geminiApiKey}`. Violates Phase 1.1.1 (must use `x-goog-api-key` header). Key can leak in logs/proxies.
2. **`as any` casts in LLM service** — `llm.service.ts:215,230,260`: `(schema as any).toJSONSchema()`, `(await res.json()) as any`, `(toolUse.input as any)?.payload`. Violates Phase 1.1.2.
3. **No `llm.fallback` timeline event** — fallback paths in `intents.service.ts:116-140` and `negotiation.service.ts:590-620` do not emit a `llm.fallback` timeline event. No UI badge for fallback mode.
4. **Mode reporting inaccurate** — `app.controller.ts:32-38` returns `llmMode: 'fixture' | 'live'` only; no `live+fallback` state. UI cannot distinguish.
5. **Negotiation doesn't explicitly respect `LLM_FORCE_LIVE`** — `negotiation.service.ts:560` checks `isDemoMode()` (which is `demoMode && !forceLive`), so forceLive works implicitly, but no explicit error when forceLive + no key.
6. **Provider authority not enforced** — `llm.service.ts:54-59` defaults unknown providers to `'anthropic'` silently; no boot failure on unknown value.
7. **No exponential backoff** — `llm.service.ts:165-190` does 1 retry with fixed 500ms delay; no distinction between 429/5xx (retryable) vs 4xx (non-retryable).
8. **No boot validation of LLM_MODEL/API key functionality** — constructor logs but doesn't validate key works; `isFixtureMode()` check at line 78 only errors if no key in live mode.
9. **Gemini structured output not using native `responseJsonSchema`** — `llm.service.ts:220-235` uses `responseMimeType: 'application/json'` and schema hint in prompt, not `responseSchema`/`responseJsonSchema`.
10. **Gemini response parsing takes only first text part** — `llm.service.ts:248`: `resJson.candidates?.[0]?.content?.parts?.[0]?.text` ignores additional parts.
11. **No AI reasoning panel in UI** — no component showing model rationale, model name, latency, mode.
12. **Missing unit tests** — no tests for header-based auth, retry logic, timeouts, schema validation in LLM service.
13. **README AI claims** — needs verification against actual implementation.

---

## B. PayPal Integration

### Orders v2 flow
- **Create order:** `apps/api/src/paypal/paypal.client.ts:280-350` — `POST /v2/checkout/orders` with `PayPal-Request-Id` idempotency header, `intent: 'CAPTURE'`, proper breakdown/items.
- **Capture order:** `apps/api/src/paypal/paypal.client.ts:352-450` — `POST /v2/checkout/orders/{id}/capture`.
- **Live mode:** When `DEMO_MODE=false` and credentials valid, real sandbox calls made (`hasValidCredentials()` check at line 95).
- **Mock mode:** When `DEMO_MODE=true` and no credentials, mock orders/captures returned (`paypal.client.ts:280-295,352-370`).

### Webhook verification
- **Raw body:** `apps/api/src/main.ts:5-10` enables `rawBody: true` on NestFactory. `webhooks.controller.ts` passes `rawBody` to service.
- **Verification:** `paypal.client.ts:452-520` calls PayPal's `/v1/notifications/verify-webhook-signature` endpoint with transmission headers, webhook ID, and event payload.
- **skipVerification guard:** `paypal.client.ts:452-480` rejects `skipVerification` in production (`NODE_ENV === 'production'`) and outside DEMO_MODE. Dev simulator (`dev-webhooks.controller.ts`) gated to non-production.

### Idempotency
- **Event deduplication:** `webhooks.service.ts:56-85` checks `prisma.webhookEvent.findUnique({ where: { eventId } })` before processing; returns `{ status: 'ignored', reason: 'WEBHOOK_DUPLICATE_IGNORED' }` for duplicates.
- **DB constraint:** `schema.prisma` `WebhookEvent.eventId` is `@unique`.
- **Ledger idempotency:** `ledger.service.ts` uses atomic create with `P2002` catch on `idempotencyKey`.

### Security
- `payments.service.ts` recomputes totals from DB items (never trusts client). `paypal.client.ts` does not log secrets. Webhook handler emits `WEBHOOK_DUPLICATE_IGNORED` activity.

**Status:** PayPal integration is largely solid. Live sandbox flow works when credentials configured. Webhook verification uses raw body and PayPal verify endpoint.

---

## C. Frontend-to-Backend Connectivity

| Screen | Route | API Endpoints | Real/Mock/Disconnected |
|--------|-------|---------------|----------------------|
| Dashboard/Command Center | `/` (`apps/web/src/app/page.tsx`) | `GET /api/products`, `POST /api/intents` (stream), `GET /api/plans`, `GET /api/policies/me`, `GET /api/timeline` | **Real** — uses `api.getProducts`, `api.createIntent`, `api.getPlans`, `api.getPolicy`, `api.getTimeline` |
| Plans list | `/plans` (`apps/web/src/app/plans/page.tsx`) | `GET /api/plans` | **Real** |
| Plan detail | `/plans/[id]` (`apps/web/src/app/plans/[id]/page.tsx`) | `GET /api/plans/:id`, `POST /api/plans/:id/evaluate`, `POST /api/plans/:id/approve`, `POST /api/plans/:id/reject`, `POST /api/plans/:id/pay`, `PATCH /api/plans/:id/alternative`, `POST /api/plans/:id/what-if`, `POST /api/plans/:id/negotiate` | **Real** |
| Payments detail | `/payments/[id]` (`apps/web/src/app/payments/[id]/page.tsx`) | `GET /api/payments/:id`, `POST /api/payments/:id/capture` | **Real** |
| Negotiation | `/negotiation` (`apps/web/src/app/negotiation/page.tsx`) | `GET /api/negotiations/:id`, `POST /api/plans/:id/negotiate` | **Real** (needs planId context) |
| Policy | `/policy` (`apps/web/src/app/policy/page.tsx`) | `GET /api/policies/me`, `PUT /api/policies/me`, `POST /api/policies/simulate` | **Real** |
| Timeline | `/timeline` (`apps/web/src/app/timeline/page.tsx`) | `GET /api/timeline`, SSE `/api/timeline/stream` | **Real** |
| Transactions | `/transactions` (`apps/web/src/app/transactions/page.tsx`) | `GET /api/analytics/transactions`, `GET /api/ledger/export` | **Real** |
| Receipts | `/receipts/[paymentId]` (`apps/web/src/app/receipts/[paymentId]/page.tsx`) | `GET /api/receipts/:paymentId`, `GET /api/receipts/:paymentId/verify` | **Real** |
| Analytics | `/analytics` (`apps/web/src/app/analytics/page.tsx`) | `GET /api/analytics/summary`, `GET /api/analytics/transactions`, `GET /api/analytics/agent-activity` | **Real** |
| Login/Signup/Welcome | `/login`, `/signup`, `/welcome` | Better Auth endpoints via `/api/auth/*` | **Real** (auth) |

**API client:** `apps/web/src/lib/api.ts` — typed fetch wrapper with Zod parsing, credentials included, toast errors. Uses Next.js rewrites (`next.config.ts`) to proxy `/api/*` to backend.

**Proxy/middleware:** `apps/web/src/proxy.ts` — session-gated routes, redirects unauthenticated to `/welcome`, redirects authenticated away from auth pages.

**Gaps:** `api.getConfigHealth()` in `api.ts:130-138` expects `llmConfigured` and `paypalMode: 'sandbox-live' | 'mock'` but backend `app.controller.ts:32-38` returns `llmMode`, `paypalMode: 'mock' | 'sandbox'`, `simulatorEnabled`, `environment` (no `llmConfigured`). Schema mismatch — needs alignment.

---

## D. Design & Legibility

**Current state:** Dark theme with CSS variables (`--ink`, `--paper`, `--rule`, `--ledger`, `--verdigris`, `--amber`, `--vermilion`, `--brass`). Typography uses Geist Sans/Mono from `next/font`. No light theme toggle. No `next-themes`. No "Ink and Signal" design language.

**Issues identified (from code review):**
- No light mode implementation; `globals.css` and components assume dark navy palette.
- Font stack is Geist/Geist Mono only — missing `Bricolage Grotesque` (display) per Phase 2 spec.
- Color tokens do not match Phase 2 spec (`--bg: #0A0B10`, `--surface: #12141C`, `--accent: #C6F432` for dark).
- No `tabular-nums` enforcement on all financial data (some places use `font-mono` but not consistently).
- No automated Axe contrast tests.
- Mobile responsiveness present but needs systematic audit across all 9+ screens.
- No animated policy-gate visual, no staggered reveals, no magnetic hover effects per spec.

**Verdict:** Complete frontend redesign required per Phase 2.

---

## E. Production Readiness

| Area | Status | Evidence |
|------|--------|----------|
| Env validation | **Missing** | No Zod-based env validation at boot; `ConfigService` used but no schema enforcement (`app.module.ts:35-40`) |
| CORS | **Partial** | Configured in `main.ts:12-22` with origin allowlist from `WEB_ORIGIN` + defaults; credentials enabled |
| Rate limiting | **Partial** | Per-route guards added (`LlmRateLimitGuard`, `FinancialMutationRateLimitGuard` in `common/rate-limit.guard.ts`); no global `@nestjs/throttler` |
| Helmet | **Missing** | Not installed/configured |
| Health endpoints | **Partial** | `GET /` and `GET /health` return status (`app.controller.ts:15-22`); `GET /health/config` exists but no `/ready` endpoint |
| Logging | **Basic** | NestJS default logger; no Pino structured JSON logging, no request ID tracking, no secret redaction |
| Error filters | **Missing** | No global exception filter |
| Graceful shutdown | **Partial** | `app.enableShutdownHooks()` in `main.ts:25`; Prisma connection closure not explicit |
| Prisma migration strategy | **Partial** | `prisma migrate dev` implied; no `prisma migrate deploy` in start scripts for production |
| Seed idempotency | **Partial** | `prisma/seed.ts` exists; idempotency needs verification |
| SSE heartbeat/reconnect | **Partial** | Timeline SSE at `timeline.controller.ts:30-50` sends heartbeat on connect but no periodic heartbeat; frontend `useEventStream.ts` has exponential backoff but no `Last-Event-ID` replay on backend |

---

## F. Repository Hygiene

| Item | Status | Notes |
|------|--------|-------|
| `docs/` | **Present** | `ARCHITECTURE.md`, `SECURITY.md`, `API.md`, `PAYPAL_SETUP.md`, `DESIGN.md`, `openapi.yaml`, subdirs `api/`, `architecture/`, `security/` |
| `postman/` | **Present** | `PayPilot.postman_collection.json`, `PayPilot.postman_environment.json` |
| `docker-compose.yml` | **Present** | Root level |
| `render.yaml` | **Present** | Root level (needs review for Phase 5 requirements) |
| `.env.example` | **Present** | `apps/api/.env.example` exists (needs secrets hygiene audit) |
| README | **Needs reconciliation** | Claims, test counts, module descriptions must be verified against actual code |

---

## Prioritized Fix List

### Blockers
1. **A1** — Move Gemini API key from URL query param to `x-goog-api-key` header (`llm.service.ts:205-206`)
2. **A2** — Remove all `as any` casts in LLM service; add Zod schemas/typed guards
3. **A3** — Emit `llm.fallback` timeline event and expose fallback mode in UI
4. **A4** — Accurate mode reporting (`live`, `live+fallback`, `fixture`) in API and UI
5. **A6** — Make `LLM_PROVIDER` authoritative; fail at boot on unknown value
6. **A7** — Exponential backoff for 429/5xx; no retry on 4xx
7. **A8** — Boot validation of LLM_MODEL and API key
8. **A9** — Use Gemini native `responseJsonSchema`/`responseSchema`
9. **A10** — Join all Gemini text parts in response
10. **A11** — AI reasoning panel in UI (rationale, model, latency, mode)
11. **C-gap** — Align `getConfigHealth` API contract between backend and frontend
12. **F** — Verify README truthfulness; audit `.env.example` for leaked secrets

### Important
1. **A5** — Negotiation explicit `LLM_FORCE_LIVE` handling
2. **A12** — LLM service unit tests (header auth, retry, timeout, schema validation)
3. **E** — Helmet, global rate limiting (`@nestjs/throttler`), Zod env validation, `/ready` endpoint
4. **E** — Structured JSON logging (Pino) with request ID and secret redaction
5. **E** — Global exception filter, graceful shutdown with Prisma disconnect
6. **E** — SSE periodic heartbeat (15-20s) and backend `Last-Event-ID` replay support
7. **Phase 2** — Complete frontend redesign ("Ink and Signal") with accessibility and Axe tests
8. **Phase 3** — End-to-end wiring, SSE robustness, error boundaries, E2E tests
9. **Phase 5** — Production-ready `render.yaml` with `prisma migrate deploy`

### Nice-to-have
1. **Phase 4** — Full production hardening (CSP tuning, Open Graph, SEO, build-time env handling)
2. **Phase 6** — Lighthouse mobile ≥ 90 optimization pass
3. Additional E2E coverage for all 9+ screens

---
