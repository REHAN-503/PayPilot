'use client';

import React, { useState } from 'react';
import { X, Sparkles, LogIn, UserPlus, AlertCircle } from 'lucide-react';
import { signIn, signUp } from '../lib/auth-client';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AuthModal({ isOpen, onClose, onSuccess }: AuthModalProps) {
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('Demo Shopper');
  const [email, setEmail] = useState('demo@paypilot.ai');
  const [password, setPassword] = useState('PayPilot123!');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleDemoLogin() {
    setLoading(true);
    setError(null);
    try {
      const res = await signIn.email({
        email: 'demo@paypilot.ai',
        password: 'PayPilot123!',
      });

      if (res.error) {
        const signupRes = await signUp.email({
          email: 'demo@paypilot.ai',
          password: 'PayPilot123!',
          name: 'Demo Shopper',
        });

        if (signupRes.error) {
          setError(signupRes.error.message || 'Demo login failed');
          return;
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const res = await signUp.email({
          email,
          password,
          name,
        });
        if (res.error) {
          setError(res.error.message || 'Registration failed');
          return;
        }
      } else {
        const res = await signIn.email({
          email,
          password,
        });
        if (res.error) {
          setError(res.error.message || 'Sign in failed');
          return;
        }
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="relative w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
        >
          <X className="h-5 w-5" />
        </button>

        <div className="mb-6">
          <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-950/60 dark:text-blue-300">
            <Sparkles className="h-3.5 w-3.5" />
            PayPilot Access
          </div>
          <h2 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-white">
            {isSignUp ? 'Create your PayPilot account' : 'Sign in to PayPilot'}
          </h2>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Permissioned AI commerce agent with verified PayPal checkout.
          </p>
        </div>

        {/* Quick Demo Login Pill for Hackathon Judges */}
        <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50/50 p-3.5 dark:border-blue-900/60 dark:bg-blue-950/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                Hackathon Demo Mode
              </p>
              <p className="text-[11px] text-blue-700 dark:text-blue-400">
                Instantly authenticate with pre-configured demo persona.
              </p>
            </div>
            <button
              type="button"
              onClick={handleDemoLogin}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow transition hover:bg-blue-700 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              1-Click Demo
            </button>
          </div>
        </div>

        <div className="relative mb-5 flex items-center justify-center">
          <div className="w-full border-t border-zinc-200 dark:border-zinc-800" />
          <span className="absolute bg-white px-3 text-xs text-zinc-400 dark:bg-zinc-950">
            or continue with email
          </span>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-red-50 p-2.5 text-xs text-red-700 dark:bg-red-950/40 dark:text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {isSignUp && (
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
                Full Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
                placeholder="Alex Mercer"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Email Address
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              placeholder="alex@example.com"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Password
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-zinc-900 py-2.5 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            {loading ? (
              'Processing...'
            ) : isSignUp ? (
              <>
                <UserPlus className="h-4 w-4" />
                Sign Up
              </>
            ) : (
              <>
                <LogIn className="h-4 w-4" />
                Sign In
              </>
            )}
          </button>
        </form>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-xs text-zinc-500 transition hover:text-zinc-900 dark:hover:text-white"
          >
            {isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}
