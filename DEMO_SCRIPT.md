# PayPilot — 2:45 Hackathon Demo Video Script & Shot List

This script provides exact second-by-second timestamps, UI actions, and spoken voiceover narration to record a crisp, high-impact demonstration under the 3:00 Devpost requirement.

---

## Pre-Recording Checklist

- [ ] **Database State**: Seeded fresh with `pnpm db:seed` or running with default test users.
- [ ] **Authentication**: Logged into `http://localhost:3000` via **"Continue as Demo User"** (`demo@paypilot.dev`).
- [ ] **PayPal Sandbox**: Logged into the PayPal Sandbox buyer account (`sb-buyer@business.example.com`) in the same browser profile so modal checkout authorizes instantly.
- [ ] **Environment**: Both API (`:4000`) and Web (`:3000`) servers active. `DEMO_MODE=true` set in `.env` for deterministic fail-safes.
- [ ] **Clean Screen**: Browser zoom set to 100%, developer console closed or docked neatly, bookmarks hidden, no background notifications or copyrighted music.

---

## Timed Shot List & Voiceover

| Time | Visual / Click Action | Spoken Narration (Word-for-Word) |
|---|---|---|
| **0:00 - 0:20** | **Welcome Hero & The Problem**<br>Start on `http://localhost:3000/welcome`. Point mouse at value proposition.<br>Click **"Continue as Demo User"**.<br>Arrive on Command Center `/`. | *"AI agents are learning to browse and recommend products. But when agents are given real credit cards, they hallucinate, fail policy rules, or fall victim to prompt injections. **PayPilot** changes that: it’s an autonomous procurement agent with a deterministic governance engine and real PayPal settlement."* |
| **0:20 - 0:45** | **Intent Submission & Planning**<br>On Command Center, click the **"Developer Monitor"** demo chip: *"I need a developer monitor under $250. Prioritize text clarity and value."*<br>Show live vertical agent execution panel stepper animating through parsing, catalog search, and ranking. | *"Watch this in action. We ask PayPilot for a developer monitor under $250. The agent parses the intent and checks the catalog. Its top pick was a 27-inch 4K monitor at $289. But notice what happens next:"* |
| **0:45 - 1:15** | **Auto-Replan & Budget Guard**<br>Point to the **Budget Guard Re-planned** badge.<br>Show the old vs new comparison card: *"-$59.01, 24-inch QHD with same calibrated sRGB panel"*. | *"PayPilot's deterministic Budget Guard immediately blocked the $289 plan because it exceeded the user's $250 transaction limit. Instead of failing, the agent automatically re-planned, finding a compliant PixelView 24-inch monitor for $229.99 with an explicit trade-off breakdown."* |
| **1:15 - 1:40** | **Approval Sheet & Risk Gate**<br>Click **"Authorize & Pay"**.<br>Bottom sheet slides up.<br>Highlight the rule-by-rule policy checklist (all green checkmarks).<br>Point to the Behavioral Risk Chip: **LOW (Score: 12)**.<br>Click **"Approve & Proceed"**. | *"Before any money moves, PayPilot presents an immutable Approval Sheet. Every deterministic policy rule is verified, and a multi-signal risk gate scores the transaction. Once authorized, official PayPal Smart Buttons appear."* |
| **1:40 - 2:00** | **PayPal Checkout & Webhook Confirmation**<br>Click the yellow **PayPal** button.<br>Sandbox modal pops up and clicks **"Complete Purchase"**.<br>Redirects to `/payments/[id]`.<br>Point to the green badge: **"Webhook Confirmed"**.<br>Click **"Duplicate Test"** in Sandbox Simulator panel: show toast *"Duplicate webhook ignored (idempotent)"*. | *"We pay with PayPal Sandbox. PayPilot creates an idempotent order with itemized breakdowns. Once captured, settlement is cryptographically verified via PayPal's authoritative webhook signature. Notice when we replay a duplicate webhook, our ledger rejects it safely."* |
| **2:00 - 2:30** | **Autonomous Agent Negotiation**<br>Navigate to `/negotiation`.<br>Select a flexible item.<br>Click **"Start Autonomous Negotiation"**.<br>Watch the two-column chat: Buyer Agent proposes $240, Merchant Agent counters $275, settling at $262.<br>Show the animated savings ticker: **+$27.00 saved (9.3%)**. | *"For flexible merchants, PayPilot can also negotiate on your behalf. Here, our Buyer Agent negotiates against an autonomous Merchant Agent over multiple concession rounds. The buyer ceiling is strictly enforced, the merchant floor stays secret on the server, and savings are locked in before routing to approval."* |
| **2:30 - 2:45** | **Trust Timeline & Conclusion**<br>Click **"Trust Timeline"** in sidebar `/timeline`.<br>Scroll through the end-to-end audit trail: Intent $\rightarrow$ Plan $\rightarrow$ Policy $\rightarrow$ Risk $\rightarrow$ Approval $\rightarrow$ PayPal $\rightarrow$ Webhook $\rightarrow$ Ledger.<br>Expand one raw JSON evidence node. | *"Every decision, policy check, and cryptographic PayPal signature is recorded in our verifiable Trust Timeline. **PayPilot doesn't just recommend commerce. It turns intent into governed, explainable payment execution.** Thank you."* |

---

## Post-Recording Check

- [ ] Video length is between 2:30 and 2:50 (under 3:00 max).
- [ ] PayPal branding is clearly visible during the checkout modal.
- [ ] Spoken audio is crisp and clear.
- [ ] Export as 1080p MP4 and upload as **Unlisted** or **Public** to YouTube for Devpost submission.

