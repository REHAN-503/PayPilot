'use client';

import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { PayPalScriptProvider } from '@paypal/react-paypal-js';
import { TooltipProvider } from './ui/select';

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      }),
  );

  const initialPayPalOptions = {
    clientId: process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID || 'sb',
    currency: 'USD',
    intent: 'capture',
    components: 'buttons',
  };

  return (
    <QueryClientProvider client={queryClient}>
      <PayPalScriptProvider options={initialPayPalOptions}>
        <TooltipProvider>
          {children}
          <Toaster
            theme="system"
            position="top-right"
            richColors
            closeButton
            toastOptions={{
              style: {
                background: 'var(--card)',
                borderColor: 'var(--rule)',
                color: 'var(--ink)',
              },
            }}
          />
        </TooltipProvider>
      </PayPalScriptProvider>
    </QueryClientProvider>
  );
}
