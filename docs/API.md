# PayPilot API Specification

All endpoints are hosted by default on `http://localhost:4000` (or through Next.js rewrites under `/api/*`). All user-facing routes require active session authentication via Better Auth cookies (`better-auth.session_token`).

---

## 1. Authentication & System Health

| Method | Path | Auth Required | Description |
|---|---|---|---|
| `GET` | `/health` | No | System health check and server uptime. |
| `GET` | `/health/config` | No | Non-secret LLM, PayPal, and simulator mode indicators. |
| `POST` | `/api/auth/sign-in/email` | No | Authenticate user via email and password. |
| `POST` | `/api/auth/sign-up/email` | No | Register new procurement user. |
| `GET` | `/api/auth/get-session` | Yes | Retrieve current active user session. |
| `POST` | `/api/auth/sign-out` | Yes | Invalidate session cookie. |

---

## 2. Procurement Intents & Planning (`/intents`, `/plans`)

| Method | Path | Auth Required | Description |
|---|---|---|---|
| `POST` | `/intents` | Yes | Submit natural-language purchase goal; parses intent, ranks catalog, evaluates policy & risk, and returns `PurchasePlan`. |
| `POST` | `/intents/stream` | Yes | SSE streaming version of intent processing with live agent activity events. |
| `GET` | `/intents` | Yes | List historical procurement intents for user. |
| `GET` | `/plans` | Yes | List all purchase plans across versions with statuses and amounts. |
| `GET` | `/plans/:id` | Yes | Get detailed plan breakdown with items, risk assessments, and approvals. |
| `POST` | `/plans/:id/evaluate` | Yes | Re-run pure deterministic policy and behavioral risk check against current plan. |
| `POST` | `/plans/:id/approve` | Yes | Authorize plan (`DRAFT` / `AWAITING_APPROVAL` $\rightarrow$ `APPROVED`). |
| `POST` | `/plans/:id/reject` | Yes | Decline plan (`AWAITING_APPROVAL` $\rightarrow$ `REJECTED`). |
| `POST` | `/plans/:id/what-if` | Yes | Simulate alternate budget constraints or quantity changes without mutating plan. |
| `PATCH` | `/plans/:id/alternative` | Yes | Swap current primary product for an alternative catalog item. |

---

## 3. Autonomous Negotiation (`/negotiations`, `/plans/:id/negotiate`)

| Method | Path | Auth Required | Description |
|---|---|---|---|
| `POST` | `/plans/:id/negotiate` | Yes | Launch multi-round bargaining between Buyer and Merchant agents. Emits rounds, enforces buyer ceiling and merchant floor. Returns new negotiated plan on agreement. |
| `GET` | `/negotiations/:id` | Yes | Get complete transcript of negotiation rounds and concessions (sanitized of merchant floor). |

---

## 4. Payments & PayPal Orders v2 (`/payments`, `/plans/:id/pay`)

| Method | Path | Auth Required | Description |
|---|---|---|---|
| `POST` | `/plans/:id/pay` | Yes | Verifies plan is `APPROVED`, performs fresh policy check, creates PayPal Orders v2 order with `PayPal-Request-Id`, and returns `{ payment, orderId }`. |
| `POST` | `/payments/:id/capture` | Yes | Captures approved PayPal order. Sets status `CAPTURE_PENDING` and awaits webhook settlement. Body: `{ orderId }`. |
| `POST` | `/payments/:id/cancel` | Yes | Cancels pending payment before capture. |
| `GET` | `/payments` | Yes | List all payments initiated by user. |
| `GET` | `/payments/:id` | Yes | Get detailed payment records, linked transactions, and cryptographic confirmation stamps. |

---

## 5. Webhooks & Dev Simulator (`/webhooks`, `/dev/webhooks`)

| Method | Path | Auth Required | Description |
|---|---|---|---|
| `POST` | `/webhooks/paypal` | No (Signature Verified) | Production PayPal webhook receiver. Validates cryptographic headers against PayPal's verification service, dedupes events, and mutates transaction ledger. |
| `POST` | `/dev/webhooks/simulate` | Yes (Dev Mode Only) | Simulator for offline hackathon testing. Triggers simulated `PAYMENT.CAPTURE.COMPLETED`, `DENIED`, `REVERSED`, or duplicate events. Body: `{ eventType, orderId?, captureId? }`. |

---

## 6. Governance Policy & Analytics (`/policies`, `/timeline`, `/analytics`)

| Method | Path | Auth Required | Description |
|---|---|---|---|
| `GET` | `/policies/me` | Yes | Get current user's deterministic spending limits and running daily/monthly spend. |
| `PUT` | `/policies/me` | Yes | Update spending limits, category rules, autonomy mode, and the agent kill-switch. |
| `POST` | `/policies/simulate` | Yes | Evaluate a hypothetical purchase without persisting it. |
| `GET` | `/budget/summary` | Yes | Daily/monthly autonomy spend and limits. |
| `GET` | `/timeline` | Yes | Get unified chronological timeline of all events across intents, plans, policy checks, payments, and webhooks. |
| `GET` | `/timeline/export?format=json\|csv` | Yes | Export the current user's timeline. |
| `GET` | `/ledger/export?format=json\|csv` | Yes | Export the current user's ledger. |
| `GET` | `/timeline/stream` | Yes | Server-Sent Events (SSE) live stream broadcasting new timeline events in real-time. |
| `GET` | `/analytics/summary` | Yes | Aggregate metrics (total spent, average risk score, approval rates, savings). |
| `GET` | `/analytics/transactions` | Yes | Tabular ledger rows for AG Grid display. |
| `GET` | `/analytics/agent-activity` | Yes | Detailed agent action log table. |
| `GET` | `/receipts/:paymentId` | Yes | Trust receipt with policy, risk, approval, PayPal, and hash-chain evidence. |
| `GET` | `/receipts/:paymentId/verify` | Yes | Recompute and verify the receipt activity hash-chain. |
| `GET` | `/products` | Yes | List all available catalog products and active stock. |
