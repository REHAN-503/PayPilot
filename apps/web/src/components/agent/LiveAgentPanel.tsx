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
        'p-5 rounded-2xl border border-slate-800 bg-slate-900/80 backdrop-blur-md shadow-xl',
        className,
      )}
    >
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 border border-blue-500/30">
            <Bot className="w-4 h-4 animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              Autonomous Agent Execution
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500" />
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Strict deterministic safety boundary active</p>
          </div>
        </div>
      </div>

      {/* Step Stepper List */}
      <div className="space-y-3 relative pl-6 before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-800">
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
                  'absolute -left-6 top-1 flex items-center justify-center w-6 h-6 rounded-full border text-xs shadow-md transition-all',
                  step.status === 'completed'
                    ? 'bg-emerald-950/90 border-emerald-500/70 text-emerald-400'
                    : step.status === 'running'
                    ? 'bg-blue-950/90 border-blue-500 text-blue-400 shadow-blue-500/30 animate-pulse'
                    : step.status === 'blocked'
                    ? 'bg-red-950/90 border-red-500 text-red-400'
                    : 'bg-slate-900 border-slate-800 text-slate-600',
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
                  'p-3 rounded-xl border transition-all',
                  isActive
                    ? 'bg-blue-950/30 border-blue-500/40 shadow-lg shadow-blue-500/10'
                    : step.status === 'completed'
                    ? 'bg-slate-900/60 border-slate-800/80 text-slate-300'
                    : step.status === 'blocked'
                    ? 'bg-red-950/20 border-red-900/40 text-red-200'
                    : 'bg-slate-950/40 border-slate-800/40 text-slate-500 opacity-60',
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon
                      className={cn(
                        'w-3.5 h-3.5',
                        step.status === 'completed'
                          ? 'text-emerald-400'
                          : step.status === 'running'
                          ? 'text-blue-400'
                          : step.status === 'blocked'
                          ? 'text-red-400'
                          : 'text-slate-500',
                      )}
                    />
                    <span className="text-xs font-semibold text-slate-200">{step.label}</span>
                  </div>

                  <span
                    className={cn(
                      'text-[10px] font-mono uppercase px-2 py-0.5 rounded-full font-medium',
                      step.status === 'completed'
                        ? 'bg-emerald-500/10 text-emerald-400'
                        : step.status === 'running'
                        ? 'bg-blue-500/15 text-blue-400 animate-pulse'
                        : step.status === 'blocked'
                        ? 'bg-red-500/10 text-red-400'
                        : 'bg-slate-800/60 text-slate-500',
                    )}
                  >
                    {step.status}
                  </span>
                </div>

                <p className="text-[11px] text-slate-400 mt-1">{step.description}</p>

                {step.detail && (
                  <div className="mt-2 text-[11px] font-mono px-2.5 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-slate-300">
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

