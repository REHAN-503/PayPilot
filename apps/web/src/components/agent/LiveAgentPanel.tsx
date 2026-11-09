'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import {
  CheckCircle2,
  CircleDashed,
  AlertCircle,
  FileSearch,
  Scale,
  ShieldCheck,
  Activity,
  Sparkles,
  Bot,
} from 'lucide-react';
import { cn } from '../../lib/utils';

export type AgentStepStatus = 'idle' | 'running' | 'completed' | 'blocked';

export interface AgentStep {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  status: AgentStepStatus;
  detail?: string;
}

interface LiveAgentPanelProps {
  steps: AgentStep[];
  currentStepId?: string;
  className?: string;
}

export function LiveAgentPanel({ steps, currentStepId, className }: LiveAgentPanelProps) {
  return (
    <div
      className={cn(
        'paper-lift p-5 rounded-[var(--radius)] border border-[var(--rule)] bg-[var(--card)]',
        className,
      )}
    >
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--rule)]">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--ledger)]/20 text-[var(--ledger)] border border-[var(--ledger)]">
            <Bot className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--ink)] flex items-center gap-2">
              Autonomous Agent Execution
              <span className="flex h-2 w-2 relative">
                <span className="hidden" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--ledger)]" />
              </span>
            </h3>
            <p className="text-[11px] text-[var(--ink-3)]">Strict deterministic safety boundary active</p>
          </div>
        </div>
      </div>

      {/* Step Stepper List */}
      <div className="space-y-3 relative pl-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--paper-2)]">
        {steps.map((step, idx) => {
          const Icon = step.icon;
          const isActive = step.id === currentStepId;

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="relative group"
            >
              {/* Status Circle */}
              <div
                className={cn(
                  'absolute -left-6 top-1 flex items-center justify-center w-6 h-6 rounded-full border text-xs  transition-all',
                  step.status === 'completed'
                    ? 'bg-[var(--paper-2)] border-[var(--verdigris)] text-[var(--verdigris)]'
                    : step.status === 'running'
                    ? 'bg-[var(--paper-2)] border-[var(--ledger)] text-[var(--ledger)]'
                    : step.status === 'blocked'
                    ? 'bg-[var(--paper-2)] border-[var(--vermilion)] text-[var(--vermilion)]'
                    : 'bg-[var(--card)] border-[var(--rule)] text-[var(--ink-3)]',
                )}
              >
                {step.status === 'completed' ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : step.status === 'running' ? (
                  <CircleDashed className="w-3.5 h-3.5 animate-spin" />
                ) : step.status === 'blocked' ? (
                  <AlertCircle className="w-3.5 h-3.5" />
                ) : (
                  <span className="text-[10px] font-semibold">{idx + 1}</span>
                )}
              </div>

              {/* Step Details */}
              <div
                className={cn(
                  'p-3 rounded-[var(--radius)] border transition-all',
                  isActive
                    ? 'bg-[var(--paper-2)] border-[var(--rule)]  '
                    : step.status === 'completed'
                    ? 'bg-[var(--card)] border-[var(--rule)] text-[var(--ink-2)]'
                    : step.status === 'blocked'
                    ? 'bg-[var(--paper-2)] border-[var(--vermilion)] text-[var(--vermilion)]'
                    : 'bg-[var(--paper)]/40 border-[var(--rule)]/40 text-[var(--ink-3)] opacity-60',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        'w-3.5 h-3.5',
                        step.status === 'completed'
                          ? 'text-[var(--verdigris)]'
                          : step.status === 'running'
                          ? 'text-[var(--ledger)]'
                          : step.status === 'blocked'
                          ? 'text-[var(--vermilion)]'
                          : 'text-[var(--ink-3)]',
                      )}
                    />
                    <span className="text-xs font-semibold text-[var(--ink)]">{step.label}</span>
                  </div>

                  <span
                    className={cn(
                      'text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-medium',
                      step.status === 'completed'
                        ? 'bg-[var(--verdigris)]/10 text-[var(--verdigris)]'
                        : step.status === 'running'
                        ? 'bg-[var(--ledger)]/15 text-[var(--ledger)]'
                        : step.status === 'blocked'
                        ? 'bg-[var(--vermilion)]/10 text-[var(--vermilion)]'
                        : 'bg-[var(--paper-2)] text-[var(--ink-3)]',
                    )}
                  >
                    {step.status}
                  </span>
                </div>

                <p className="text-[11px] text-[var(--ink-3)] mt-1">{step.description}</p>

                {step.detail && (
                  <div className="mt-2 text-[11px] font-mono px-2.5 py-1.5 rounded-lg bg-[var(--paper)] border border-[var(--rule)] text-[var(--ink-2)]">
                    {step.detail}
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export const INITIAL_AGENT_STEPS: AgentStep[] = [
  {
    id: 'parse',
    label: 'Parsing Purchase Intent',
    description: 'Structured parameter extraction and prompt-injection hardening.',
    icon: Sparkles,
    status: 'idle',
  },
  {
    id: 'search',
    label: 'Searching Verified Catalog',
    description: 'Deterministic database lookup bounded by category and budget.',
    icon: FileSearch,
    status: 'idle',
  },
  {
    id: 'rank',
    label: 'Ranking & Tradeoff Analysis',
    description: 'Selecting primary recommendation with alternatives.',
    icon: Scale,
    status: 'idle',
  },
  {
    id: 'policy',
    label: 'Evaluating Budget Guard',
    description: 'Pure deterministic enforcement of transaction & daily limits.',
    icon: ShieldCheck,
    status: 'idle',
  },
  {
    id: 'risk',
    label: 'Assessing Risk Heuristics',
    description: 'Price divergence, velocity, and merchant risk evaluation.',
    icon: Activity,
    status: 'idle',
  },
  {
    id: 'ready',
    label: 'Plan Ready for Authorization',
    description: 'Generating purchase plan and setting up PayPal checkout order.',
    icon: CheckCircle2,
    status: 'idle',
  },
];
