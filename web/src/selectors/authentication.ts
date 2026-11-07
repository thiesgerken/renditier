import type { RootState } from '../store';

export function isAuthenticated(state: RootState): boolean {
  const { authentication } = state;

  return authentication.userInfo !== null;
}

export function isAuthenticationInitialized(state: RootState): boolean {
  const { authentication } = state;

  return authentication.loginAttempted;
}
