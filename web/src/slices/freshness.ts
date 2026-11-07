const MAX_AGE_MS = 60 * 60 * 1e3;

// Loaded data is refetched once it is older than this.
export const isOutdated = (lastUpdated: number | null): boolean =>
  lastUpdated !== null && Date.now() - lastUpdated > MAX_AGE_MS;
