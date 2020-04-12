export function isAuthenticated(state) {
  const { authentication } = state;

  return authentication.userInfo !== null; // && !authentication.didInvalidate;
}

export function isAuthenticationInitialized(state) {
  const { authentication } = state;

  return authentication.loginAttempted;
}
