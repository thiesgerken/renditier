import { afterEach, describe, expect, it, vi } from 'vitest';

import { fetchOk } from './api';

const respond = (body: string, status: number, statusText: string) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(body, { status, statusText })))
  );

describe('fetchOk', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('reports the error a 400 explains', async () => {
    respond('{"error":"unknown receipt type"}', 400, 'Bad Request');
    await expect(fetchOk('/api/receipts')).rejects.toThrow(
      'unknown receipt type'
    );
  });

  it('falls back to the status without a usable body', async () => {
    respond('', 404, 'Not Found');
    await expect(fetchOk('/api/accounts/1')).rejects.toThrow('404 Not Found');
  });
});
