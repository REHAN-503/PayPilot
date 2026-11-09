import { createAuthClient } from 'better-auth/react';

export async function authenticate(
  action: 'sign-in' | 'sign-up',
  body: Record<string, string>,
) {
  const response = await fetch(`/api/auth/${action}/email`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    message?: string;
    user?: unknown;
  };

  if (!response.ok) {
    throw new Error(payload.message || `Authentication failed (${response.status})`);
  }

  return payload;
}

export const authClient = createAuthClient({
  fetchOptions: {
    credentials: 'include',
  },
});

export const { signIn, signUp, useSession, signOut } = authClient;
