'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Bot,
  ShieldCheck,
  CreditCard,
  Sparkles,
  ArrowRight,
  Cpu,
} from 'lucide-react';
import { Button } from '../../components/ui/button';
import { loginAsDemoUser } from '../../lib/demo-auth';

export default function WelcomePage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = React.useState(false);

  const handleDemoLogin = async () => {
    setIsLoading(true);
    await loginAsDemoUser(router);
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] text-[var(--ink)] flex flex-col justify-between selection:bg-[var(--ledger)] selection:text-[var(--ledger-ink)]">
      {/* Top Navbar */}
      <header className="px-6 h-20 max-w-7xl w-full mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[var(--radius)] bg-[var(--ledger)] flex items-center justify-center shadow-[2px_3px_0_color-mix(in_srgb,var(--ink)_12%,transparent)]">
            <Bot className="w-5 h-5 text-[var(--ledger-ink)]" />
          </div>
          <span className="font-bold text-xl tracking-tight text-[var(--ink)]">PayPilot</span>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/login">
            <Button variant="ghost" className="text-[var(--ink-2)] hover:text-[var(--ink)]">
              Sign In
            </Button>
          </Link>
          <Button
            variant="glow"
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="hidden sm:inline-flex"
          >
            {isLoading ? 'Connecting...' : 'Launch Demo'}
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-12 flex flex-col items-center text-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="desk-enter inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--ledger)]/10 border border-[var(--ledger)]/25 text-[var(--ledger)] text-xs font-semibold uppercase tracking-wider mb-6"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Next-Gen Autonomous Agent Procurement</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.08 }}
          className="desk-enter desk-enter-delay-1 text-4xl sm:text-6xl font-black text-[var(--ink)] tracking-tight leading-[1.1] max-w-3xl"
        >
          Tell PayPilot what you want. <br />
          <span className="text-[var(--ledger)]">
            It plans, proves, asks, pays.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.16 }}
          className="desk-enter desk-enter-delay-2 mt-6 text-base sm:text-lg text-[var(--ink-3)] max-w-2xl leading-relaxed"
        >
          An autonomous procurement copilot for PayPal Orders v2. Governed by deterministic spending policies, two-party cryptographic approvals, and immutable ledger auditability.
        </motion.p>

        {/* CTA Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.24 }}
          className="desk-enter desk-enter-delay-3 mt-8 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto"
        >
          <Button
            size="lg"
            variant="glow"
            onClick={handleDemoLogin}
            disabled={isLoading}
            className="w-full sm:w-auto h-13 px-8 text-base  "
          >
            {isLoading ? 'Entering Sandbox...' : 'Continue as Demo User'}
            <ArrowRight className="w-5 h-5 ml-2" />
          </Button>

          <Link href="/login" className="w-full sm:w-auto">
            <Button size="lg" variant="outline" className="w-full sm:w-auto h-13 px-6">
              Enter with Credentials
            </Button>
          </Link>
        </motion.div>

        {/* 3-Step Graphic */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.32 }}
          className="desk-enter desk-enter-delay-3 mt-16 w-full grid grid-cols-1 md:grid-cols-3 gap-6 text-left"
        >
          <div className="paper-lift p-6 rounded-3xl bg-[var(--card)] border border-[var(--rule)]">
            <div className="w-10 h-10 rounded-[var(--radius)] bg-[var(--ledger)]/20 text-[var(--ledger)] flex items-center justify-center mb-4 border border-[var(--ledger)]">
              <Cpu className="w-5 h-5" />
            </div>
            <div className="text-xs font-mono text-[var(--ledger)] uppercase font-semibold">Step 01</div>
            <h3 className="text-base font-bold text-[var(--ink)] mt-1">Intent & Planning</h3>
            <p className="text-xs text-[var(--ink-3)] mt-2 leading-relaxed">
              Express natural goals. PayPilot filters verified catalog inventory, calculates tradeoffs, and auto-replans cheaper substitutions.
            </p>
          </div>

          <div className="paper-lift p-6 rounded-3xl bg-[var(--card)] border border-[var(--rule)]">
            <div className="w-10 h-10 rounded-[var(--radius)] bg-[var(--brass)]/20 text-[var(--brass)] flex items-center justify-center mb-4 border border-[var(--brass)]">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div className="text-xs font-mono text-[var(--brass)] uppercase font-semibold">Step 02</div>
            <h3 className="text-base font-bold text-[var(--ink)] mt-1">Deterministic Policy Gate</h3>
            <p className="text-xs text-[var(--ink-3)] mt-2 leading-relaxed">
              Code guards verify daily spend, category whitelists, and velocity heuristics. Zero LLM hallucinations touch your budget.
            </p>
          </div>

          <div className="paper-lift p-6 rounded-3xl bg-[var(--card)] border border-[var(--rule)]">
            <div className="w-10 h-10 rounded-[var(--radius)] bg-[var(--paper-2)] text-[var(--verdigris)] flex items-center justify-center mb-4 border border-[var(--verdigris)]">
              <CreditCard className="w-5 h-5" />
            </div>
            <div className="text-xs font-mono text-[var(--verdigris)] uppercase font-semibold">Step 03</div>
            <h3 className="text-base font-bold text-[var(--ink)] mt-1">PayPal Orders v2</h3>
            <p className="text-xs text-[var(--ink-3)] mt-2 leading-relaxed">
              Smart capture execution with authoritative webhook verification, stamped immutably to the transaction ledger.
            </p>
          </div>
        </motion.div>
      </main>

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-[var(--rule)] text-center text-xs text-[var(--ink-3)]">
        PayPilot AI • PayPal Developer Sandbox Demo • Fully Governed Autonomous Procurement
      </footer>
    </div>
  );
}
