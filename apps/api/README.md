# PayPilot API

NestJS API for purchase planning, policy checks, approvals, PayPal orders, and the audit timeline.

For full local setup, demo mode, OpenRouter configuration, and PayPal Sandbox instructions, see the [project README](../../README.md) and [PayPal setup guide](../../docs/PAYPAL_SETUP.md).

## Local development

From the repository root:

```bash
cp apps/api/.env.example apps/api/.env
pnpm install
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm --filter api start:dev
```

The API reads environment values from `apps/api/.env` and listens on port `4000` by default. Start the web app separately with `pnpm --filter web dev`.

## LLM provider

Set `LLM_PROVIDER` to `openrouter`, `gemini`, or `anthropic` in `apps/api/.env`. For OpenRouter, set `OPENROUTER_API_KEY` and an OpenRouter `provider/model` ID in `LLM_MODEL`. Keep provider keys in this API env file; never expose them through the web app.

With `DEMO_MODE=true` and `LLM_FORCE_LIVE=false`, built-in example prompts use local fixtures. Set `LLM_FORCE_LIVE=true` to require a provider request. See the root README for how these options interact with PayPal mock and Sandbox behavior.

## Useful endpoints

- `GET /health` — API availability
- `GET /health/config` — non-secret LLM, PayPal, and runtime mode indicators
- `POST /api/intents/stream` — streamed purchase planning
- `GET /api/timeline/stream` — live audit events
