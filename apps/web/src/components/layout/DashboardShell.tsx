'use client';

import * as React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { Sheet, SheetContent } from '../ui/sheet';

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  return (
    <div className="flex min-h-[100dvh] w-full min-w-0 dashboard-bg text-[var(--ink)] antialiased">
      {/* Desktop Sidebar */}
      <Sidebar className="hidden md:flex shrink-0 sticky top-0 h-screen overflow-y-auto" />

      {/* Mobile Drawer */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="p-0 bg-[var(--card)] border-r border-[var(--rule)]"
          style={{ width: 'var(--sidebar-w, 260px)' }}>
          <Sidebar onClose={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Main Content Area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar onMenuClick={() => setMobileOpen(true)} />
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-3 sm:p-5 lg:p-8">
          <div className="mx-auto w-full min-w-0 max-w-[1400px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
