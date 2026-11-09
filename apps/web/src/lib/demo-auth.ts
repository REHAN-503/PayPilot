import { authClient } from './auth-client';
import { toast } from 'sonner';

export async function loginAsDemoUser(router: { push: (url: string) => void }) {
  try {
    toast.loading('Signing in as Demo User...', { id: 'demo-login' });

    // Try sign in as demo@paypilot.dev
    const signInRes = await authClient.signIn.email({
      email: 'demo@paypilot.dev',
      password: 'Password123!',
    });

    if (signInRes.error) {
      // If user does not exist, try sign up
      const signUpRes = await authClient.signUp.email({
        email: 'demo@paypilot.dev',
        password: 'Password123!',
        name: 'Demo Procurement User',
      });

      if (signUpRes.error) {
        throw new Error(signUpRes.error.message || 'Demo authentication failed');
      }
    }

    toast.success('Welcome to PayPilot Demo!', { id: 'demo-login' });
    router.push('/');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Please check API connection.';
    toast.error('Demo Sign-In Failed', {
      id: 'demo-login',
      description: message,
    });
  }
}

