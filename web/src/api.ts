import type { ErrString } from './types/api';

// Every API call treats a non-2xx status as a failure; the thrown message is
// what ends up in the slices' `error` fields. Only a 400 carries a body that
// says what went wrong, so anything else falls back to the status.
export const fetchOk = async (
  url: string,
  init?: RequestInit
): Promise<Response> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const body = (await response
      .json()
      .catch(() => null)) as Partial<ErrString> | null;
    throw new Error(body?.error ?? `${response.status} ${response.statusText}`);
  }
  return response;
};

export const fetchJson = async <T>(
  url: string,
  init?: RequestInit
): Promise<T> => {
  const response = await fetchOk(url, init);
  return (await response.json()) as T;
};
