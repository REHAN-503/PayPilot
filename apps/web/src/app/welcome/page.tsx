"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Bot,
  CircleDollarSign,
  Fingerprint,
  Code2,
  Menu,
  Pause,
  ShieldCheck,
  Sparkles,
  WalletCards,
  X,
} from "lucide-react";
import { Button } from "../../components/ui/button";
import { loginAsDemoUser } from "../../lib/demo-auth";

const scenes = [
  {
    id: "plans",
    number: "01",
    label: "Plans & approvals",
    title: "From a sentence to a signed-off purchase.",
    description:
      "Describe the outcome. PayPilot compares real catalog options, explains the tradeoffs, and prepares a plan for your review.",
    icon: WalletCards,
    points: [
      "Catalog-backed options",
      "Clear totals before checkout",
      "You stay in control",
    ],
  },
  {
    id: "policy",
    number: "02",
    label: "Policy engine",
    title: "A rulebook the agent cannot rewrite.",
    description:
      "A deterministic policy engine checks transaction caps, daily and monthly budgets, categories, and approval rules before payment.",
    icon: ShieldCheck,
    points: [
      "Per-purchase ceiling",
      "Daily and monthly limits",
      "Approval thresholds",
    ],
  },
  {
    id: "budgets",
    number: "03",
    label: "Budgets",
    title: "Know what is spent and what remains.",
    description:
      "Captured purchases roll into your spend history. Current limits and remaining budget stay visible in policy settings.",
    icon: CircleDollarSign,
    points: [
      "Captured spend only",
      "Currency-safe calculations",
      "Clear remaining balance",
    ],
  },
  {
    id: "ledger",
    number: "04",
    label: "Audit ledger",
    title: "A record of every important decision.",
    description:
      "Plans, approvals, payment events, and verified webhooks are recorded so you can follow the purchase from start to finish.",
    icon: Fingerprint,
    points: [
      "Append-only transaction history",
      "Payment event trail",
      "Webhook verification status",
    ],
  },
  {
    id: "risk",
    number: "05",
    label: "Risk & pause",
    title: "Pause the agent whenever you need.",
    description:
      "Policy checks happen again before checkout. The kill switch blocks new agent actions until you resume it.",
    icon: Pause,
    points: [
      "Fresh check at checkout",
      "Pause agent controls",
      "Human approval stays explicit",
    ],
  },
  {
    id: "negotiation",
    number: "06",
    label: "Negotiation",
    title: "Explore a better price within hard bounds.",
    description:
      "The buyer and merchant agents can explore offers, while the configured transaction ceiling remains in force.",
    icon: Sparkles,
    points: [
      "Bounded offer rounds",
      "Readable rationale",
      "You approve the final plan",
    ],
  },
  {
    id: "assistant",
    number: "07",
    label: "AI planning",
    title: "AI proposes. Code decides.",
    description:
      "Language models help interpret goals and explain options. They never decide whether a payment is permitted.",
    icon: Bot,
    points: [
      "Provider fallback support",
      "Deterministic policy decision",
      "Secrets stay server-side",
    ],
  },
  {
    id: "promise",
    number: "08",
    label: "The promise",
    title: "Guardrails, not guesswork.",
    description:
      "PayPilot is built to make the decision path inspectable: proposal, policy verdict, approval, sandbox payment, and ledger.",
    icon: BadgeCheck,
    points: [
      "Policy before payment",
      "No real money moves",
      "Built for a hackathon",
    ],
  },
];

const integrations = [
  "PayPal Orders v2",
  "PayPal Webhooks",
  "OpenRouter",
  "Gemini",
  "PostgreSQL",
  "Better Auth",
  "Render",
];

function ScenePanel({
  scene,
  index,
}: {
  scene: (typeof scenes)[number];
  index: number;
}) {
  const Icon = scene.icon;
  return (
    <div aria-hidden="true" className="welcome-scene-card">
      <div className="flex items-center justify-between gap-4 border-b border-[var(--rule)] pb-5">
        <div className="flex items-center gap-3">
          <span className="welcome-icon">
            <Icon size={19} />
          </span>
          <div>
            <p className="text-xs text-[var(--ink-3)]">
              PAYPILOT / {scene.number}
            </p>
            <p className="font-semibold">{scene.label}</p>
          </div>
        </div>
        <span className="welcome-status">
          <span />
          Sandbox
        </span>
      </div>
      {index === 0 ? (
        <div className="pt-6">
          <div className="flex items-center justify-between text-xs text-[var(--ink-3)]">
            <span>Purchase proposal</span>
            <span>Plan PP-1042</span>
          </div>
          <div className="mt-4 flex items-center gap-4 rounded-2xl border border-[var(--rule)] bg-[var(--paper)] p-4">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-[var(--paper-2)] text-[var(--ledger)]">
              <WalletCards />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">Developer monitor</p>
              <p className="text-xs text-[var(--ink-3)]">
                1 item · catalog match
              </p>
            </div>
            <strong className="font-mono">$229.99</strong>
          </div>
          <div className="my-6 grid grid-cols-4 gap-2 text-center text-[10px] sm:text-xs">
            {["Intent", "Policy", "Approval", "Sandbox"].map((step, i) => (
              <div key={step} className="space-y-2">
                <span
                  className={`mx-auto flex size-7 items-center justify-center rounded-full ${i < 2 ? "bg-[var(--ledger)] text-[var(--ledger-ink)]" : "border border-[var(--rule)] text-[var(--ink-3)]"}`}
                >
                  {i < 2 ? "✓" : i + 1}
                </span>
                <span>{step}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-xl bg-[var(--paper-2)] p-4">
            <div>
              <p className="text-xs text-[var(--ink-3)]">Policy decision</p>
              <p className="mt-1 font-semibold text-[var(--verdigris)]">
                REQUIRE_APPROVAL
              </p>
            </div>
            <span className="welcome-status">
              <span />
              Within limit
            </span>
          </div>
        </div>
      ) : (
        <div className="space-y-3 pt-6">
          {scene.points.map((point, i) => (
            <div
              key={point}
              className="flex items-center gap-3 rounded-xl border border-[var(--rule)] bg-[var(--paper)] p-4"
            >
              <span
                className={`flex size-7 items-center justify-center rounded-full ${i === 0 ? "bg-[var(--ledger)] text-[var(--ledger-ink)]" : "bg-[var(--paper-2)] text-[var(--verdigris)]"}`}
              >
                {i === 0 ? "✓" : "•"}
              </span>
              <span className="flex-1 text-sm">{point}</span>
              <span className="text-xs text-[var(--ink-3)]">
                {i === 0 ? "Verified" : "Ready"}
              </span>
            </div>
          ))}
          <div className="welcome-ledger mt-5">
            <span>Policy verdict</span>
            <strong>
              {index === 4
                ? "AGENT PAUSED"
                : index === 1
                  ? "ALLOW / REVIEW / BLOCK"
                  : "RECORDED"}
            </strong>
            <span>Audit event · just now</span>
          </div>
        </div>
      )}
    </div>
  );
}

export default function WelcomePage() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [isLoading, setIsLoading] = React.useState(false);
  const [menuOpen, setMenuOpen] = React.useState(false);

  const handleDemoLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await loginAsDemoUser(router);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="welcome-page min-h-screen bg-[var(--paper)] text-[var(--ink)] selection:bg-[var(--ledger)] selection:text-[var(--ledger-ink)]">
      <div className="welcome-disclosure">
        PayPilot is a hackathon project, not a financial institution. PayPal
        Sandbox only. No real money moves.
      </div>
      <header className="welcome-header sticky top-0 z-40 border-b border-[var(--rule)] bg-[color-mix(in_srgb,var(--paper)_88%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex h-[68px] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Link
            href="/welcome"
            aria-label="PayPilot home"
            className="flex items-center gap-2.5 font-semibold tracking-tight"
          >
            <span className="welcome-logo">
              <Bot size={20} />
            </span>
            <span>
              pay<span className="font-normal">pilot</span>
            </span>
          </Link>
          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-7 text-sm lg:flex"
          >
            <a className="welcome-navlink" href="#product">
              Product
            </a>
            <a className="welcome-navlink" href="#proof">
              How it works
            </a>
            <a className="welcome-navlink" href="#resources">
              Resources
            </a>
          </nav>
          <div className="hidden items-center gap-3 sm:flex">
            <Link href="/login" className="welcome-navlink text-sm">
              Log in
            </Link>
            <Button
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="welcome-button"
            >
              {isLoading ? "Connecting…" : "Try the demo"}
              <ArrowRight size={16} />
            </Button>
          </div>
          <button
            type="button"
            className="welcome-menu-button sm:hidden"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(!menuOpen)}
          >
            {menuOpen ? <X /> : <Menu />}
          </button>
        </div>
        {menuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="grid gap-1 border-t border-[var(--rule)] bg-[var(--paper)] p-4 sm:hidden"
          >
            <a href="#product" onClick={() => setMenuOpen(false)}>
              Product
            </a>
            <a href="#proof" onClick={() => setMenuOpen(false)}>
              How it works
            </a>
            <a href="#resources" onClick={() => setMenuOpen(false)}>
              Resources
            </a>
            <Link href="/login">Log in</Link>
            <Button
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="welcome-button mt-2"
            >
              Try the demo <ArrowRight size={16} />
            </Button>
          </nav>
        )}
      </header>

      <main>
        <section className="welcome-hero mx-auto max-w-7xl px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20 lg:pt-24">
          <div
            className="welcome-marquee"
            aria-label="Policy-gated payments · verified webhooks · append-only ledger"
          >
            <div>
              {Array.from({ length: 4 }, (_, i) => (
                <span key={i}>
                  Policy-gated payments <i /> Signature-verified webhooks <i />{" "}
                  Append-only audit ledger <i /> Open source (MIT) <i />{" "}
                </span>
              ))}
            </div>
          </div>
          <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_.95fr] lg:gap-8">
            <div>
              <motion.p
                initial={reduceMotion ? false : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="welcome-eyebrow"
              >
                <Sparkles size={14} /> Governed purchasing, built for agents
              </motion.p>
              <motion.h1
                initial={reduceMotion ? false : { opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.08 }}
                className="welcome-title"
              >
                Commerce built for{" "}
                <span className="welcome-highlight">autonomous</span> agents.
              </motion.h1>
              <motion.p
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.16 }}
                className="welcome-lede"
              >
                Tell the agent what you need. A rulebook it cannot rewrite
                decides what it may buy. PayPal Sandbox settles. A ledger
                records what happened.
              </motion.p>
              <motion.div
                initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.24 }}
                className="mt-8 flex flex-col gap-3 sm:flex-row"
              >
                <Button
                  onClick={handleDemoLogin}
                  disabled={isLoading}
                  className="welcome-button welcome-button-large"
                >
                  {isLoading ? "Connecting…" : "Try the demo"}
                  <ArrowRight size={17} />
                </Button>
                <a className="welcome-secondary" href="#product">
                  See how it works <ArrowDown size={16} />
                </a>
              </motion.div>
              <p className="mt-5 text-xs text-[var(--ink-3)]">
                Free to explore in Sandbox. No real purchases or money movement.
              </p>
            </div>
            <div className="welcome-hero-visual">
              <ScenePanel scene={scenes[0]} index={0} />
              <div className="welcome-float-chip">
                <ShieldCheck size={15} /> Policy checked <span>✓</span>
              </div>
              <div className="welcome-float-chip welcome-float-chip-bottom">
                <Fingerprint size={15} /> Ledger recorded
              </div>
            </div>
          </div>
        </section>

        <section id="product" className="welcome-section welcome-section-muted">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="welcome-section-heading">
              <p className="welcome-eyebrow">From intent to evidence</p>
              <h2>
                Everything an agent needs to shop. Everything you need to stay
                in control.
              </h2>
              <p>
                Explore the parts of a purchase that matter: what was proposed,
                what policy allowed, and what PayPal Sandbox confirmed.
              </p>
            </div>
            <div className="space-y-16 lg:space-y-24">
              {scenes.map((scene, index) => (
                <article
                  id={scene.id}
                  key={scene.id}
                  className={`welcome-feature ${index % 2 ? "lg:[&>div:first-child]:order-2" : ""}`}
                >
                  <div className="welcome-feature-copy">
                    <p className="welcome-eyebrow">
                      Scene {scene.number} · {scene.label}
                    </p>
                    <h3>{scene.title}</h3>
                    <p>{scene.description}</p>
                    <ul>
                      {scene.points.map((point) => (
                        <li key={point}>
                          <BadgeCheck size={17} />
                          {point}
                        </li>
                      ))}
                    </ul>
                    <Link
                      className="welcome-text-link"
                      href={
                        index === 1 || index === 2
                          ? "/policy"
                          : index === 3
                            ? "/timeline"
                            : index === 5
                              ? "/negotiation"
                              : "/"
                      }
                    >
                      {index === 3
                        ? "Explore the audit timeline"
                        : index === 1 || index === 2
                          ? "Review policy settings"
                          : index === 5
                            ? "Open negotiation"
                            : "Explore the demo"}
                      <ArrowUpRight size={16} />
                    </Link>
                  </div>
                  <div className="welcome-stage">
                    <ScenePanel scene={scene} index={index} />
                    <p className="welcome-stage-caption">
                      Illustrative interface · Demo values
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="proof" className="welcome-section">
          <div className="mx-auto grid max-w-7xl gap-10 px-5 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
            <div>
              <p className="welcome-eyebrow">What you can verify yourself</p>
              <h2 className="welcome-display">
                The important decisions are inspectable.
              </h2>
              <p className="mt-5 max-w-lg text-[var(--ink-2)]">
                The model can help interpret a request. Payment authority lives
                in separate policy checks, user approval, PayPal Sandbox, and
                verified events.
              </p>
              <Link
                className="welcome-text-link mt-6 inline-flex"
                href="/timeline"
              >
                View the audit timeline <ArrowUpRight size={16} />
              </Link>
            </div>
            <div className="welcome-proof-grid">
              <div>
                <ShieldCheck />
                <strong>Deterministic policy</strong>
                <span>
                  Caps, categories, spend windows, and approval thresholds are
                  evaluated in code.
                </span>
              </div>
              <div>
                <Fingerprint />
                <strong>Append-only trail</strong>
                <span>
                  Important purchase and payment transitions are recorded for
                  review.
                </span>
              </div>
              <div>
                <BadgeCheck />
                <strong>Verified webhooks</strong>
                <span>
                  Payment status is confirmed from PayPal webhook events.
                </span>
              </div>
              <div>
                <Pause />
                <strong>Human control</strong>
                <span>
                  Approvals and the agent pause control remain available to the
                  user.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="welcome-section welcome-section-muted">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="welcome-section-heading">
              <p className="welcome-eyebrow">Integrations</p>
              <h2>Every piece, finally in sync.</h2>
              <p>
                Built from familiar services and an auditable application stack.
              </p>
            </div>
            <div className="welcome-integrations">
              {integrations.map((name, i) => (
                <div key={name}>
                  <span>
                    {name
                      .split(/\s/)
                      .map((word) => word[0])
                      .join("")
                      .slice(0, 2)}
                  </span>
                  <p>{name}</p>
                  <small>
                    {i < 2
                      ? "PayPal Sandbox"
                      : i === 2 || i === 3
                        ? "AI provider"
                        : "Application stack"}
                  </small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="resources" className="welcome-section">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="welcome-section-heading">
              <p className="welcome-eyebrow">Get started</p>
              <h2>See what is ahead, not just what cleared.</h2>
              <p>Open a working part of PayPilot or read the setup guides.</p>
            </div>
            <div className="welcome-resources">
              <Link href="/" className="welcome-resource">
                <span>01 / PRODUCT</span>
                <strong>Try the command center</strong>
                <p>Create a purchase plan from a natural-language goal.</p>
                <ArrowUpRight />
              </Link>
              <Link href="/policy" className="welcome-resource">
                <span>02 / GOVERNANCE</span>
                <strong>Configure your policy</strong>
                <p>Review limits, autonomy mode, and approvals.</p>
                <ArrowUpRight />
              </Link>
              <Link href="/analytics" className="welcome-resource">
                <span>03 / EVIDENCE</span>
                <strong>Review spending analytics</strong>
                <p>Follow captured transactions and activity.</p>
                <ArrowUpRight />
              </Link>
              <Link
                href="https://github.com/REHAN-503/PayPilot"
                target="_blank"
                rel="noreferrer"
                className="welcome-resource"
              >
                <span>04 / SOURCE</span>
                <strong>Read the project docs</strong>
                <p>Setup and architecture are documented in the repository.</p>
                <Code2 />
              </Link>
            </div>
          </div>
        </section>

        <section className="welcome-cta-wrap">
          <div className="welcome-cta">
            <p className="welcome-eyebrow">Sandbox ready</p>
            <h2>Payments that think ahead.</h2>
            <p>
              Explore a governed purchasing workflow with seeded demo data and
              PayPal Sandbox.
            </p>
            <Button
              onClick={handleDemoLogin}
              disabled={isLoading}
              className="welcome-button welcome-button-large"
            >
              {isLoading ? "Connecting…" : "Try the demo"}
              <ArrowRight size={17} />
            </Button>
            <span className="welcome-cta-note">
              A hackathon project. No real money moves.
            </span>
          </div>
        </section>
      </main>

      <footer className="welcome-footer">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div>
              <Link
                href="/welcome"
                className="flex items-center gap-2 font-semibold"
              >
                <span className="welcome-logo">
                  <Bot size={18} />
                </span>
                pay<span className="font-normal">pilot</span>
              </Link>
              <p className="mt-4 max-w-sm text-sm text-[var(--ink-3)]">
                A hackathon project for governed agent purchasing. PayPal
                Sandbox only; not a financial institution.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-sm">
              <Link href="/">Demo</Link>
              <Link href="/policy">Policy</Link>
              <Link href="/timeline">Audit timeline</Link>
              <Link href="/login">Log in</Link>
              <Link href="/analytics">Analytics</Link>
              <Link href="/signup">Create account</Link>
            </div>
          </div>
          <div className="mt-10 flex flex-col gap-2 border-t border-[var(--rule)] pt-5 text-xs text-[var(--ink-3)] sm:flex-row sm:justify-between">
            <span>Built for the PayPal AI Hackathon</span>
            <span>
              Demo figures are illustrative. AI may be wrong. Nothing moves real
              money.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
