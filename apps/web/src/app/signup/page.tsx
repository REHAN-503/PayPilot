'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Bot, ArrowRight, Sparkles, Lock, Mail, User } from 'lucide-react';
import { authClient } from '../../lib/auth-client';
import { loginAsDemoUser } from '../../lib/demo-auth';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../../components/ui/card';
import { toast } from 'sonner';

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [isDemoLoading, setIsDemoLoading] = React.useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await authClient.signUp.email({
        name,
        email,
        password,
      });
      if (res.error) {
        toast.error('Signup Failed', { description: res.error.message });
      } else {
        toast.success('Account created successfully');
        router.push('/');
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      toast.error('Sign-up Error', { description: message });
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
    <div className="min-h-screen bg-[#070b14] flex flex-col justify-center items-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 mb-3 shadow-xl shadow-blue-500/25">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Create PayPilot Account</h2>
          <p className="text-xs text-slate-400 mt-1">Setup your autonomous procurement agent</p>
        </div>

        <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-900/30 via-indigo-900/20 to-purple-900/30 border border-blue-500/30 shadow-lg">
          <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-blue-300">
            <Sparkles className="w-3.5 h-3.5 text-blue-400" />
            <span>Fast Track Demo Access</span>
          </div>
          <p className="text-xs text-slate-300 mb-3 leading-relaxed">
            Skip registration and enter immediately with pre-funded sandbox balance.
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

        <Card className="border-slate-800 bg-slate-900/70">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-white">Create Credentials</CardTitle>
            <CardDescription className="text-xs">
              Configure personal policy boundaries and wallet keys
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  Full Name
                </label>
                <Input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Procurement Manager"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-slate-400" />
                  Email Address
                </label>
                <Input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="admin@organization.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
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
                {isSubmitting ? 'Creating account...' : 'Create Account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          Already have an account?{' '}
          <Link href="/login" className="text-blue-400 hover:text-blue-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

