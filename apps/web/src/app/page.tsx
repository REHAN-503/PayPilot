'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Layers,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react';
import { useSession, signOut } from '../lib/auth-client';
import { api } from '../lib/api';
import { Navbar } from '../components/Navbar';
import { AuthModal } from '../components/AuthModal';
import { PolicyModal } from '../components/PolicyModal';
import { PlanCard } from '../components/PlanCard';
import { TimelineView } from '../components/TimelineView';
import { LedgerView } from '../components/LedgerView';
import { ApprovalsView } from '../components/ApprovalsView';
import { CatalogView } from '../components/CatalogView';
import type { PurchasePlan, Product, AgentActivity, UserPolicy } from '../types';

const SUGGESTIONS = [
  'Find noise-cancelling headphones under $200',
  'Find an ergonomic mouse under $100',
  'Buy a 4K productivity monitor under $350',
  'Get a smart room air purifier under $180',
  'Need a studio USB microphone under $120',
];

export default function Home() {
  const { data: session, isPending: sessionLoading } = useSession();
  const user = session?.user;

  const [currentTab, setCurrentTab] = useState<'agent' | 'approvals' | 'ledger' | 'catalog'>('agent');
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active Plan & Audit Timeline
  const [activePlan, setActivePlan] = useState<PurchasePlan | null>(null);
  const [alternatives, setAlternatives] = useState<Product[]>([]);
  const [activities, setActivities] = useState<AgentActivity[]>([]);

  // Policy snapshot & pending count
  const [policyData, setPolicyData] = useState<UserPolicy | null>(null);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState(0);

  // Modals
  const [authOpen, setAuthOpen] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);

  const refreshPolicyAndApprovals = useCallback(() => {
    if (!user) return;

    api
      .getPolicy()
      .then((res) => setPolicyData(res.policy))
      .catch(() => {});

    api
      .getPendingApprovals()
      .then((res) => setPendingApprovalsCount(res?.length || 0))
      .catch(() => {});
  }, [user]);

  function reloadActivePlan() {
    if (!activePlan?.id || !user) return;
    api
      .getPlan(activePlan.id)
      .then((plan) => {
        setActivePlan(plan);
        if (plan?.intent?.activities) {
          setActivities(plan.intent.activities);
        }
      })
      .catch(() => {});
    refreshPolicyAndApprovals();
  }

  useEffect(() => {
    if (user) {
      refreshPolicyAndApprovals();
      api
        .getIntents()
        .then((intents) => {
          if (intents && intents.length > 0) {
            const latest = intents[0];
            if (latest.plans && latest.plans.length > 0) {
              setActivePlan(latest.plans[0]);
            }
            if (latest.activities) {
              setActivities(latest.activities);
            }
          }
        })
        .catch(() => {});
    }
  }, [user, refreshPolicyAndApprovals]);

  async function handleSendPrompt(textToSend?: string) {
    const rawInput = (textToSend ?? prompt).trim();
    if (!rawInput) return;

    if (!user) {
      setAuthOpen(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await api.createIntent(rawInput);
      setActivePlan(res.plan);
      setAlternatives(res.alternatives || []);
      setPrompt('');

      if (res.intent?.id) {
        const fullIntent = await api.getIntent(res.intent.id);
        setActivities(fullIntent.activities || []);
      }

      refreshPolicyAndApprovals();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Agent failed to process your request');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans text-zinc-900 dark:bg-black dark:text-zinc-100 flex flex-col">
      <Navbar
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        pendingApprovalsCount={pendingApprovalsCount}
        policy={policyData}
        user={user}
        onOpenAuth={() => setAuthOpen(true)}
        onOpenPolicy={() => setPolicyOpen(true)}
        onSignOut={() => signOut()}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {/* Unauthenticated Quick Banner */}
        {!user && !sessionLoading && (
          <div className="mb-8 rounded-2xl border border-blue-200 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-transparent p-5 dark:border-blue-900/60">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h3 className="font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-blue-500" />
                  Welcome to PayPilot (PayPal AI Hackathon)
                </h3>
                <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400 max-w-2xl">
                  PayPilot transforms natural-language purchase intent into a governed, explainable payment execution workflow:
                  <strong className="text-zinc-900 dark:text-white"> AI proposes. Policy Engine decides. User authorizes. PayPal executes. Webhooks verify. Ledger records.</strong>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAuthOpen(true)}
                className="shrink-0 flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white shadow-md transition hover:bg-blue-700"
              >
                Sign In / 1-Click Demo
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Tab 1: Agent Studio */}
        {currentTab === 'agent' && (
          <div className="space-y-8">
            {/* Prompt Studio Input */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                  <Sparkles className="h-4 w-4" />
                  Autonomous Commerce Agent
                </span>
                <span className="text-[11px] text-zinc-400">
                  Currency: USD • Sandbox Orders v2
                </span>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendPrompt();
                }}
                className="relative"
              >
                <input
                  type="text"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe your purchase goal (e.g. 'Find noise-cancelling headphones under $200')..."
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50/70 px-5 py-4 pr-32 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-800 dark:bg-zinc-900 dark:text-white dark:focus:bg-zinc-950"
                />

                <button
                  type="submit"
                  disabled={loading || !prompt.trim()}
                  className="absolute right-2.5 top-2.5 bottom-2.5 flex items-center gap-1.5 rounded-xl bg-blue-600 px-5 text-xs font-bold text-white shadow transition hover:bg-blue-700 disabled:opacity-40"
                >
                  {loading ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Propose Plan
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>

              {/* Suggestion Chips */}
              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[11px] text-zinc-400">Try demo:</span>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setPrompt(s);
                      handleSendPrompt(s);
                    }}
                    className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-[11px] font-medium text-zinc-600 transition hover:border-blue-400 hover:bg-blue-50 hover:text-blue-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-xs text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Split Screen: Active Plan & Audit Trail */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left Column (2 Cols): Plan Presentation */}
              <div className="lg:col-span-2 space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <Layers className="h-4 w-4 text-blue-500" />
                    AI Proposed Purchase Plan
                  </h3>
                  {activePlan && (
                    <span className="text-xs text-zinc-400">
                      Evaluated by Deterministic Policy Engine
                    </span>
                  )}
                </div>

                {activePlan ? (
                  <PlanCard
                    plan={activePlan}
                    alternatives={alternatives}
                    onPlanUpdated={reloadActivePlan}
                    onViewLedger={() => setCurrentTab('ledger')}
                  />
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/50 p-12 text-center dark:border-zinc-800 dark:bg-zinc-950/50">
                    <Sparkles className="mx-auto h-10 w-10 text-zinc-400" />
                    <h4 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">
                      No active purchase plan
                    </h4>
                    <p className="mt-1 text-xs text-zinc-500 max-w-sm mx-auto">
                      Type your purchase goal above or click one of the suggested prompts to let PayPilot generate an optimized plan.
                    </p>
                  </div>
                )}
              </div>

              {/* Right Column (1 Col): Explainable Audit Timeline */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-base font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                    <ShieldCheck className="h-4 w-4 text-emerald-500" />
                    Explainability Timeline
                  </h3>
                  <span className="text-xs text-zinc-400">Audit Trail</span>
                </div>

                <div className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950 max-h-[600px] overflow-y-auto">
                  <TimelineView activities={activities} />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Approvals View */}
        {currentTab === 'approvals' && (
          <ApprovalsView onApprovalDone={refreshPolicyAndApprovals} />
        )}

        {/* Tab 3: Ledger View */}
        {currentTab === 'ledger' && <LedgerView />}

        {/* Tab 4: Catalog View */}
        {currentTab === 'catalog' && (
          <CatalogView
            onSelectPrompt={(text) => {
              setCurrentTab('agent');
              setPrompt(text);
              handleSendPrompt(text);
            }}
          />
        )}
      </main>

      {/* Footer */}
      <footer className="mt-auto border-t border-zinc-200 bg-white py-6 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-7xl flex-col sm:flex-row items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 text-xs text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-2">
            <span className="font-bold text-zinc-900 dark:text-white">PayPilot</span>
            <span>•</span>
            <span>PayPal AI Hackathon</span>
            <span>•</span>
            <span className="font-mono text-[11px]">DEMO_MODE={process.env.NEXT_PUBLIC_API_URL ? 'online' : 'ready'}</span>
          </div>
          <div>
            Pure Policy Limits • Cryptographic Idempotency • Authoritative Webhook Settlement
          </div>
        </div>
      </footer>

      {/* Modals */}
      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        onSuccess={() => {
          refreshPolicyAndApprovals();
        }}
      />

      <PolicyModal
        isOpen={policyOpen}
        onClose={() => setPolicyOpen(false)}
        onPolicyUpdated={refreshPolicyAndApprovals}
      />
    </div>
  );
}
