'use client';

import React from 'react';
import {
  ShieldCheck,
  Zap,
  Sliders,
  FileText,
  ShoppingBag,
  User,
  LogOut,
  Sparkles,
} from 'lucide-react';
import type { UserPolicy, UserProfile } from '../types';

interface NavbarProps {
  currentTab: 'agent' | 'approvals' | 'ledger' | 'catalog';
  setCurrentTab: (tab: 'agent' | 'approvals' | 'ledger' | 'catalog') => void;
  pendingApprovalsCount: number;
  policy: UserPolicy | null;
  user: UserProfile | null | undefined;
  onOpenAuth: () => void;
  onOpenPolicy: () => void;
  onSignOut: () => void;
}

export function Navbar({
  currentTab,
  setCurrentTab,
  pendingApprovalsCount,
  policy,
  user,
  onOpenAuth,
  onOpenPolicy,
  onSignOut,
}: NavbarProps) {
  const autonomyMode = policy?.autonomyMode ?? 'ASK_EVERY_TIME';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-sky-400 text-white shadow-md shadow-blue-500/20">
            <Zap className="h-5 w-5 fill-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
                PayPilot
              </span>
              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
                AI Agent
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Permissioned PayPal Commerce
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
          <button
            type="button"
            onClick={() => setCurrentTab('agent')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
              currentTab === 'agent'
                ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <Sparkles className="h-4 w-4 text-blue-500" />
            Agent Studio
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('approvals')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
              currentTab === 'approvals'
                ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-500" />
            Approvals
            {pendingApprovalsCount > 0 && (
              <span className="ml-1 rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-bold text-white">
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('ledger')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
              currentTab === 'ledger'
                ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <FileText className="h-4 w-4 text-indigo-500" />
            Ledger
          </button>

          <button
            type="button"
            onClick={() => setCurrentTab('catalog')}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all ${
              currentTab === 'catalog'
                ? 'bg-white text-zinc-950 shadow-sm dark:bg-zinc-800 dark:text-white'
                : 'text-zinc-600 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-white'
            }`}
          >
            <ShoppingBag className="h-4 w-4 text-purple-500" />
            Catalog
          </button>
        </nav>

        {/* Right Section: Policy Status & User Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={onOpenPolicy}
            className="flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-xs font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800"
            title="Configure Budget Guard & Autonomy Policies"
          >
            <Sliders className="h-3.5 w-3.5 text-zinc-500" />
            <span className="hidden sm:inline">Autonomy:</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">
              {autonomyMode === 'AUTO_WITHIN_LIMITS'
                ? 'Auto (Limits)'
                : autonomyMode === 'MANUAL_APPROVAL'
                  ? 'Strict'
                  : 'Ask Always'}
            </span>
          </button>

          {user ? (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 rounded-lg border border-zinc-200 px-2.5 py-1 dark:border-zinc-800">
                <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center text-xs text-white font-semibold">
                  {user.name?.[0]?.toUpperCase() ?? user.email?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <span className="max-w-[100px] truncate text-xs font-medium text-zinc-800 dark:text-zinc-200">
                  {user.name || user.email}
                </span>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800"
                title="Sign out"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={onOpenAuth}
              className="flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
            >
              <User className="h-3.5 w-3.5" />
              Sign In
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
