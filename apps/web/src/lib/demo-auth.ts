import { authenticate } from './auth-client';
import { toast } from 'sonner';

export async function loginAsDemoUser(router: { replace: (url: string) => void }) {
  try {
    toast.loading('Signing in as Demo User...', { id: 'demo-login' });

    // Try sign in as demo@paypilot.dev
    let signedIn = true;
    try {
      await authenticate('sign-in', {
      email: 'demo@paypilot.dev',
      password: 'Password123!',
      });
    } catch {
      signedIn = false;
    }

    if (!signedIn) {
      // If user does not exist, try sign up
      await authenticate('sign-up', {
        email: 'demo@paypilot.dev',
        password: 'Password123!',
        name: 'Demo Procurement User',
      });
    }

    const sessionResponse = await fetch('/api/auth/get-session', {
      credentials: 'include',
      cache: 'no-store',
    });
    const session = (await sessionResponse.json().catch(() => null)) as { user?: unknown } | null;
    if (!sessionResponse.ok || !session?.user) {
      throw new Error('The session cookie was not established. Please try again.');
    }

    toast.success('Welcome to PayPilot Demo!', { id: 'demo-login' });
    router.replace('/');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Please check API connection.';
    toast.error('Demo Sign-In Failed', {
      id: 'demo-login',
      description: message,
    });
  }
}
