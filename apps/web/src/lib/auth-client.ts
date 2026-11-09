import { createAuthClient } from 'better-auth/react';

export const authClient = createAuthClient({
  baseURL: '',  // same-origin: auth requests go through Next.js rewrites (/api/auth/* → API)
});

export const { signIn, signUp, useSession, signOut } = authClient;

