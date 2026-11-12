# Landing Experience Audit and Plan

## Existing implementation

- The App Router uses a root layout with shared query, PayPal, tooltip, and toast providers. `globals.css` owns the existing day/night dashboard tokens.
- `/welcome` is currently a client rendered, single hero with demo sign in and three feature cards. Login and signup are separate pages with duplicated styling and prefilled demo credentials on login.
- `next.config.ts` rewrites `/api/*` to the API service. There is no assistant route or client stream proxy today.
- API modules use NestJS and Prisma. `LlmRateLimitGuard` provides an in-memory per-IP/per-route minute limit for existing LLM endpoints; it is not suitable for a durable global daily assistant cap.
- The project already has OpenRouter-backed planning support, but the landing brief's public Ask AI assistant is a separate feature and must not be confused with the purchasing agent.

## Conflicts and implementation decisions

- The requested reference is Novo's banking marketing site. PayPilot is a sandbox hackathon project, so its section rhythm and animated product demonstrations can be adapted, but banking promises, financial proof, Novo assets, and Novo-specific claims cannot be reused. The page must prominently state that PayPilot is not a financial institution, uses PayPal Sandbox only, and moves no real money.
- The requested three-palette system and full eight-scene choreography are substantially broader than the current one-page app. Keep the existing dashboard theme contract working while introducing semantic landing tokens; avoid changing authenticated dashboard routes as part of the marketing work.
- Any price savings or spend figures shown in scenes are labeled illustrative demo data. Verified implementation claims link to actual repository code. No fabricated testimonials, ratings, or customer counts.
- Live Ask AI must use the server-side OpenRouter key and visibly label demo fallback. Rate limiting and usage caps must fail closed to demo responses without blocking deterministic policy enforcement for purchases.
- Acceptance work should be incremental: fix and cover money-unit correctness first, then implement the landing shell and meaningful product scenes, then add assistant/security/accessibility checks. Do not claim Lighthouse, contrast, deployment, or full responsive acceptance without running those checks.

## Prioritized work

1. Normalize historical spend to dollars at API boundaries and centralize its calculation so intent, plan, policy, negotiation, and payment decisions use identical timezone and currency rules.
2. Treat configured zero limits as real limits throughout policy evaluation and UI editing; retain null as the only "unlimited" value.
3. Add regression coverage for month/day boundaries, decimal precision, policy comparison, and zero limits.
4. Replace `/welcome` with a responsive, accessible PayPilot marketing page inspired by Novo's section structure, using truthful Sandbox disclosures and working links to existing app routes.
5. Continue with palette/assistant sections only where they can be completed and verified against the existing stack; document remaining scope rather than claiming unverified completion.
