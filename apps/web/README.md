# PayPilot Web

Next.js frontend for PayPilot’s purchase planning, approval, policy, transaction, and audit workflows.

For full-stack setup and environment modes, see the [project README](../../README.md).

## Local development

From the repository root:

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm install
pnpm --filter web dev
```

The frontend runs on port `3000`. Start PostgreSQL and the API separately; the web app forwards `/api/*` requests to the API configured by `NEXT_PUBLIC_API_URL`.

For a local mock-payment demo, set `NEXT_PUBLIC_PAYPAL_CLIENT_ID=sb`. For PayPal Sandbox checkout, use the client ID that matches the API credentials.

## Main routes

- `/welcome` — demo entry and sign-in links
- `/` — purchase planning and recent activity
- `/plans` — saved purchase plans
- `/transactions` — payment and ledger history
- `/policy` — spending rules and autonomy settings
- `/timeline` — verifiable activity history
- `/analytics` — spend and governance summaries
