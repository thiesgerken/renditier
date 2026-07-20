import type { RootState } from '../types/store';

export function isAuthenticated(state: RootState): boolean {
  const { authentication } = state;

  return authentication.userInfo !== null; // && !authentication.didInvalidate;
}

export function isAuthenticationInitialized(state: RootState): boolean {
  const { authentication } = state;

  return authentication.loginAttempted;
}
