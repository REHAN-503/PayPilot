'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, ArrowRight, Sparkles, Lock, Mail } from 'lucide-react';
import { authenticate } from '../../lib/auth-client';
import { loginAsDemoUser } from '../../lib/demo-auth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { toast } from 'sonner';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState('demo@paypilot.ai');
  const [password, setPassword] = React.useState('Password123!');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDemoLoading, setIsDemoLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await authenticate('sign-in', { email, password });
      toast.success('Signed in successfully');
      router.replace('/');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Sign-in Error', { description: message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDemoLogin = async () => {
    setIsDemoLoading(true);
    await loginAsDemoUser(router);
    setIsDemoLoading(false);
  };

  return (
    <div className="min-h-screen bg-[var(--paper)] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[var(--radius)] bg-[var(--ledger)] mb-3 shadow-[2px_3px_0_color-mix(in_srgb,var(--ink)_12%,transparent)]">
            <Bot className="w-6 h-6 text-[var(--ledger-ink)]" />
          </div>
          <h2 className="text-2xl font-bold text-[var(--ink)] tracking-tight">Sign in to PayPilot</h2>
          <p className="text-xs text-[var(--ink-3)] mt-1">Autonomous PayPal Procurement Agent</p>
        </div>

        {/* Demo User Fast Track Card */}
        <div className="p-4 rounded-[var(--radius)] bg-[var(--paper-2)] border border-[var(--ledger)] ">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-[var(--ledger)]">
            <Sparkles className="w-3.5 h-3.5 text-[var(--ledger)]" />
            <span>Hackathon Evaluation Sandbox</span>
          </div>
          <p className="text-xs text-[var(--ink-2)] mb-3 leading-relaxed">
            Instant evaluation login with pre-funded PayPal Sandbox accounts and seeded inventory.
          </p>
          <Button
            variant="glow"
            onClick={handleDemoLogin}
            disabled={isDemoLoading}
            className="w-full font-semibold"
          >
            {isDemoLoading ? 'Launching Demo...' : 'Continue as Demo User'}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </div>

        {/* Standard Form */}
        <Card className="border-[var(--rule)] bg-[var(--card)]/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-[var(--ink)]">Credentials Sign In</CardTitle>
            <CardDescription className="text-xs">
              Use your registered PayPilot account credentials
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--ink-2)] flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-[var(--ink-3)]" />
                  Email Address
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="demo@paypilot.ai"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-[var(--ink-2)] flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-[var(--ink-3)]" />
                  Password
                </label>
                <Input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                />
              </div>

              <Button
                type="submit"
                variant="default"
                disabled={isSubmitting}
                className="w-full mt-2"
              >
                {isSubmitting ? 'Authenticating...' : 'Sign In'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-[var(--ink-3)]">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-[var(--ledger)] hover:text-[var(--ledger)] font-medium">
            Create account
          </Link>
        </p>
      </div>
    </div>
  );
}
