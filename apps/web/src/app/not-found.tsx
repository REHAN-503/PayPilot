import Link from 'next/link';
import {
  Home,
  ArrowLeft,
  Store,
  Bot,
  ShoppingBag,
  BarChart3,
} from 'lucide-react';

const quickLinks = [
  { label: 'Dashboard', href: '/', icon: Home },
  { label: 'Store', href: '/store', icon: Store },
  { label: 'AI Chat', href: '/chat', icon: Bot },
  { label: 'Plans', href: '/plans', icon: ShoppingBag },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
];

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6"
      style={{
        background: 'radial-gradient(ellipse 60% 50% at 50% -20%, rgba(52,73,232,0.12), transparent 60%), var(--paper)',
      }}
    >
      {/* Animated background grid */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-[0.03]">
        <div className="absolute inset-0"
          style={{
            backgroundImage: 'linear-gradient(var(--rule) 1px, transparent 1px), linear-gradient(90deg, var(--rule) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      <div className="relative max-w-2xl w-full text-center space-y-8 desk-enter">

        {/* PayPilot logo */}
        <div className="flex justify-center">
          <div className="w-16 h-16 rounded-[20px] flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #3449e8 0%, #7c3aed 100%)' }}>
            <svg viewBox="0 0 32 32" className="w-9 h-9 text-white" aria-hidden="true">
              <path d="M6 19 18 7l8 8-12 12-3-5-5-3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              <path d="m9 17 7 2.5 3-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </div>
        </div>

        {/* 404 display */}
        <div className="space-y-2">
          <div className="relative inline-block">
            <span
              className="text-[9rem] sm:text-[12rem] font-black leading-none tracking-tighter select-none"
              style={{
                background: 'linear-gradient(135deg, #3449e8 0%, rgba(52,73,232,0.3) 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              404
            </span>
            {/* Floating error badge */}
            <div
              className="absolute -top-3 -right-6 px-3 py-1.5 rounded-full text-xs font-bold text-white"
              style={{ background: '#dc3545' }}
            >
              Oops!
            </div>
          </div>
        </div>

        {/* Message */}
        <div className="space-y-3">
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight" style={{ color: 'var(--ink, #0d1117)' }}>
            This page doesn&apos;t exist
          </h1>
          <p style={{ color: 'var(--ink-3, #6b7585)' }} className="max-w-md mx-auto leading-relaxed">
            The page you&apos;re looking for has either been moved, deleted, or never existed.
            Let PayPilot guide you back on track.
          </p>
        </div>

        {/* Error detail card */}
        <div className="inline-flex items-center gap-3 px-4 py-3 rounded-[12px] border text-sm"
          style={{
            background: 'var(--card, #fff)',
            borderColor: 'var(--rule, #dde1e9)',
            boxShadow: '0 2px 8px rgba(13,17,23,0.06)',
          }}>
          <span className="w-2 h-2 rounded-full" style={{ background: '#dc3545' }} />
          <span className="font-mono" style={{ color: 'var(--ink-3, #6b7585)' }}>HTTP 404</span>
          <span style={{ color: 'var(--ink-3, #6b7585)' }}>·</span>
          <span style={{ color: 'var(--ink-2, #3a4150)' }}>Page not found</span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href="/"
            className="pressable inline-flex items-center gap-2 px-6 py-3 rounded-[12px] text-sm font-bold text-white transition-all"
            style={{ background: 'linear-gradient(135deg, #3449e8 0%, #5767e8 100%)' }}
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <Link
            href="/plans"
            className="pressable inline-flex items-center gap-2 px-6 py-3 rounded-[12px] text-sm font-semibold transition-all"
            style={{
              color: 'var(--ink, #0d1117)',
              border: '1px solid var(--rule, #dde1e9)',
              background: 'var(--card, #fff)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            View Plans
          </Link>
        </div>

        {/* Quick nav links */}
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--ink-3, #6b7585)' }}>
            Quick navigation
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            {quickLinks.map(({ label, href, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-[10px] text-xs font-semibold border transition-all"
                style={{
                  borderColor: 'var(--rule, #dde1e9)',
                  background: 'var(--card, #fff)',
                  color: 'var(--ink-2, #3a4150)',
                }}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
              </Link>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-[11px]" style={{ color: 'var(--ink-3, #6b7585)' }}>
          <Link href="/welcome" className="underline underline-offset-4 hover:opacity-70 transition-opacity">
            PayPilot
          </Link>
          {' '}— Autonomous AI Procurement · PayPal Sandbox
        </p>

      </div>
    </div>
  );
}
