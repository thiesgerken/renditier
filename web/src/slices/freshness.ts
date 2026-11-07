const MAX_AGE_MS = 60 * 60 * 1e3;

interface Loadable {
  isFetching: boolean;
  // Plot caches are never invalidated, so they have no such flag.
  didInvalidate?: boolean;
  // Also set by a failed load, so that a failure is only retried once the data
  // is outdated or invalidated, instead of after every render.
  lastUpdated: number | null;
}

// Whether data was never loaded, has been invalidated by a change elsewhere,
// or is older than MAX_AGE_MS.
export const needsFetch = ({
  isFetching,
  didInvalidate = false,
  lastUpdated,
}: Loadable): boolean =>
  !isFetching &&
  (lastUpdated === null ||
    didInvalidate ||
    Date.now() - lastUpdated > MAX_AGE_MS);
