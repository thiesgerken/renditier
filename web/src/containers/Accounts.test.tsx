import { MemoryRouter } from 'react-router-dom';

import { createAppStore } from '../store';
import { clickButton, render } from '../testing';
import Accounts from './Accounts';

describe('the accounts page', () => {
  let cleanup: () => void;
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows a failed load instead of an empty list, and loads again on retry', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(null, { status: 500, statusText: 'Internal Server Error' })
      )
      .mockResolvedValueOnce(Response.json([]));
    vi.stubGlobal('fetch', fetch);
    cleanup = await render(
      <MemoryRouter>
        <Accounts />
      </MemoryRouter>,
      createAppStore()
    );

    const text = () => document.body.textContent;
    expect(text()).toContain('Die Daten konnten nicht geladen werden');
    expect(text()).toContain('500 Internal Server Error');
    expect(text()).not.toContain('Noch keine Depots');

    await clickButton('Erneut versuchen');

    expect(fetch).toHaveBeenCalledTimes(2);
    expect(text()).not.toContain('Die Daten konnten nicht geladen werden');
    expect(text()).toContain('Noch keine Depots');
  });
});
