export const DEMO_USER_EMAIL = 'demo@paypilot.dev';

export function isDemoAccount(email: string | undefined): boolean {
  return email?.toLowerCase() === DEMO_USER_EMAIL;
}
