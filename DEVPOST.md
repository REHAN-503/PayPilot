# PayPilot — Devpost Submission

## Inspiration

Autonomous AI agents are rapidly evolving from conversational assistants to operational actors capable of making decisions and executing tools. However, when AI agents interact with financial systems, existing architectures rely on fragile prompts: either asking an LLM "is this okay to buy?" or granting an agent unrestricted wallet access. This produces catastrophic failure modes: prompt injection attacks, budget hallucinations, runaway spending, and zero financial accountability.

We built **PayPilot** to solve this missing link: **autonomous procurement with deterministic governance**. We wanted to prove that an agent can parse goals, evaluate trade-offs, and negotiate lower prices while remaining strictly bounded by unbreachable spending limits, automated risk gates, and cryptographic PayPal payment settlement.

---

## What It Does

PayPilot is an autonomous commerce agent and verifiable procurement cockpit. Instead of just suggesting links, PayPilot turns intent into governed payment execution:

1. **Autonomous Procurement Planning**: Users provide freeform goals (e.g., *"Find a developer monitor under $250 with crisp text clarity"*). The agent extracts constraints, scans the catalog, ranks matching products, and produces an itemized `PurchasePlan` with trade-off analysis.
2. **Deterministic Governance & Budget Guard**: Every plan must pass through a side-effect-free Policy Engine. If a proposed item exceeds limits (e.g., $289 vs a $250 limit), the agent automatically executes an **Auto-Replan loop** to identify the best compliant substitute (e.g., PixelView 24" for $229.99), explaining the exact trade-offs.
3. **Multi-Factor Behavioral Risk Gate**: Every plan is scored (0–100) across 6 weighted behavioral signals: historical spending deviations, velocity (payments in trailing 10 minutes), stock scarcity, merchant trust, and negotiation volatility.
4. **Multi-Agent Buyer ↔ Merchant Negotiation**: For flexible merchants, PayPilot launches an autonomous bargaining session between a Buyer Agent and a Merchant Agent. The code enforces an unbreachable buyer ceiling and server-hidden merchant reserve floor, negotiating down prices over monotone concession rounds.
5. **Interactive Governance Approval**: When ready, users inspect an itemized Approval Sheet containing a rule-by-rule policy checklist and risk score chip before approving.
6. **PayPal Orders v2 & Webhook Settlement**: Upon authorization, PayPilot creates an idempotent PayPal Orders v2 checkout. Users authorize the transaction using official PayPal Smart Buttons. Final settlement is only recognized once PayPal's cryptographic webhook is received and verified.
7. **Verifiable Trust Timeline & Audit Ledger**: An immutable chronological event stream capturing every step (Intent $\rightarrow$ Plan $\rightarrow$ Policy $\rightarrow$ Risk $\rightarrow$ Approval $\rightarrow$ PayPal $\rightarrow$ Webhook $\rightarrow$ Ledger) with inspectable raw evidence payloads.

---

## How We Built It

### Architecture & Tech Stack
- **Frontend**: Next.js 16 App Router (React 19, Tailwind CSS v4, Framer Motion, AG Grid Community v36, Recharts, Lucide Icons, Sonner). Configured with Next.js rewrites to eliminate CORS and proxy cookies seamlessly.
- **Backend**: NestJS Enterprise Gateway with TypeScript, Better Auth session authentication, Server-Sent Events (SSE) streaming, and Prisma ORM on PostgreSQL.
- **Pure Governance Core**: Side-effect-free, zero-dependency policy and risk evaluation modules with 100% test coverage and finite state machines (`PlanStatus`, `PaymentStatus`, `NegotiationStatus`).

### How AI is Used
- **Structured Intent Extraction**: Parses messy, natural-language purchasing queries into typed procurement constraints (category, budget ceilings, required specs, priority weights).
- **Multi-Agent Concession Game**: Powers natural-language bargaining between a buyer persona (arguing budget constraints) and a merchant persona (arguing quality and volume), bounded by deterministic mathematical guards.
- **Trade-Off Synthesis**: Automatically contrasts primary recommendations against cheaper alternatives, generating concise, fact-based justifications.

### How PayPal is Used
- **Orders v2 REST API**: Generates structured orders with itemized breakdowns (subtotal, tax, shipping, discount, invoice ID, and custom payment tracking IDs).
- **PayPal-Request-Id Idempotency**: Transmits unique cryptographic hashes on order creation and capture to eliminate double-charging risks under network retries.
- **PayPal JavaScript SDK (@paypal/react-paypal-js)**: Implements PayPal Smart Buttons directly inside the interactive Approval Sheet.
- **Authoritative Cryptographic Webhooks**: Processes `PAYMENT.CAPTURE.COMPLETED`, `DENIED`, `REVERSED`, and `REFUNDED` events. Every webhook signature is verified via PayPal's `/v1/notifications/verify-webhook-signature` endpoint. Replay protection uses unique event ID deduplication.

---

## Challenges We Overcame

1. **Eliminating Generative Hallucination from Financial Decisions**: Traditional AI agents often hallucinate approvals when prompted persuasively. We solved this by architecting the Policy Engine as pure, non-LLM code that evaluates database records directly. The LLM can never override policy.
2. **Hidden Merchant Floor Preservation**: During multi-agent negotiations, ensuring the buyer agent never discovers the merchant's secret reserve price required strict server-side compartmentalization.
3. **Idempotency & Out-of-Order Webhook Delivery**: Payment webhooks can arrive before the frontend redirects or arrive twice during network retries. We engineered a strict finite state machine that handles pending states, verifies cryptographic signatures, and ignores duplicates safely.

---

## Accomplishments We're Proud Of

- **402 Passing Tests**: Comprehensive test suite spanning unit tests, governance rule engines, risk gates, state machine transitions, and Playwright end-to-end smoke tests on both desktop and mobile viewports.
- **Zero `any` Types**: Strictly typed TypeScript across the entire monorepo, paired with Zod schemas validating API boundaries.
- **Dual Operating Modes**: Fully functional in live PayPal Sandbox mode, and equipped with a deterministic `DEMO_MODE` fallback with simulated webhooks for reliable presentations.

---

## What We Learned

Bridging generative AI with real payment rails requires treating LLMs as **advisors**, not **executors**. Financial security in autonomous agents is fundamentally an architectural problem, not a prompting problem. Deterministic state machines and cryptographic verification provide the safety rails necessary for human users to trust agents with capital.

---

## What's Next

- **Multi-Merchant Split Orders**: Expanding planning logic to distribute complex procurement baskets across multiple independent PayPal merchants.
- **Scheduled Subscription Governance**: Extending the policy engine to monitor and automatically re-negotiate recurring SaaS renewals.
- **Merchant Integration Gateway**: Providing an open webhook protocol for merchant inventory feeds to join the automated negotiation network.

---

## Tools Used

- **Anthropic Claude / Gemini API**: Powers intent parsing, trade-off summarization, and multi-agent negotiation dialogue.
- **PayPal Orders v2 API**: Programmatic order creation, itemized breakdown structuring, and capture execution.
- **PayPal Webhooks API**: Cryptographically signed real-time notifications for payment settlement and dispute lifecycle.
- **PayPal JavaScript SDK (`@paypal/react-paypal-js`)**: Client-side Smart Buttons integrated into the responsive approval sheet.
- **Next.js 16 (App Router)**: Modern React 19 frontend with server components, proxy route protection, and streaming UI.
- **NestJS**: Scalable, modular backend architecture handling REST endpoints, event streams, and background jobs.
- **Prisma & PostgreSQL**: Relational data modeling, double-entry transaction ledgers, and atomic state transitions.
- **AG Grid Community**: High-performance dark-themed tabular views for transaction ledgers and agent audit logs.
- **Render**: Blueprint-based cloud deployment hosting PostgreSQL, NestJS API, and Next.js frontend.
- **Postman**: Complete exported API test collection and environment for reproducible developer verification.

