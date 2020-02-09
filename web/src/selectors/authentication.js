export function isAuthenticated(state) {
  const { authentication } = state;

  return authentication.userInfo !== null && !authentication.didInvalidate;
}

export function isAuthenticationInitialized(state) {
  const { authentication } = state;

  if (
    authentication.userInfo === null &&
    !authentication.isFetching &&
    authentication.error === null
  )
    return false;

  return true;
}
