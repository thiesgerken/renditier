import { act } from 'react';

import { createAppStore } from '../store';
import { clickButton, render } from '../testing';
import type { ApiKey } from '../types/api';
import ApiKeys from './ApiKeys';

const existing: ApiKey = {
  id: 1,
  name: 'moneta',
  prefix: '0123abcd',
  access: 'read',
  expiresAt: null,
  createdAt: '2026-11-01T09:00:00Z',
  lastUsedAt: null,
};

const json = (body: unknown) => Promise.resolve(Response.json(body));

// React tracks a controlled input's value itself, so the value has to go
// through the prototype's setter for the change to reach it.
const type = (selector: string, value: string) =>
  act(() => {
    const input = document.querySelector<HTMLInputElement>(selector);
    if (input === null) throw new Error(`no input ${selector}`);
    Reflect.set(HTMLInputElement.prototype, 'value', value, input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });

describe('the API keys card', () => {
  let cleanup: () => void;
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('refuses a taken name and shows a new key once', async () => {
    const fetch = vi.fn((_url: string, init?: RequestInit) =>
      init?.method === 'POST'
        ? json({
            apiKey: { ...existing, id: 2, name: 'lumi', access: 'write' },
            token: 'rk_4567cdef.secret',
          })
        : json([existing])
    );
    vi.stubGlobal('fetch', fetch);
    cleanup = await render(<ApiKeys />, createAppStore());

    expect(document.body.textContent).toContain('moneta');
    expect(document.body.textContent).toContain('nie benutzt');

    await clickButton('Neuer Schlüssel');
    type('#api-key-name', ' moneta ');
    await clickButton('Erstellen');
    expect(document.body.textContent).toContain(
      'Es gibt schon einen Schlüssel mit diesem Namen.'
    );
    expect(fetch).toHaveBeenCalledTimes(1);

    type('#api-key-name', 'lumi');
    await clickButton('Erstellen');
    expect(JSON.parse(fetch.mock.calls[1]?.[1]?.body as string)).toEqual({
      name: 'lumi',
      access: 'read',
      expiresAt: null,
    });
    expect(document.body.textContent).toContain('rk_4567cdef.secret');

    await clickButton('Schließen');
    expect(document.body.textContent).not.toContain('rk_4567cdef.secret');
  });
});
