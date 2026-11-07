// Every API call treats a non-2xx status as a failure; the thrown message is
// what ends up in the slices' `error` fields.
export const fetchOk = async (
  url: string,
  init?: RequestInit
): Promise<Response> => {
  const response = await fetch(url, init);
  if (!response.ok)
    throw new Error(`${response.status} ${response.statusText}`);
  return response;
};

export const fetchJson = async <T>(
  url: string,
  init?: RequestInit
): Promise<T> => {
  const response = await fetchOk(url, init);
  return (await response.json()) as T;
};
