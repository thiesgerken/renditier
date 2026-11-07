import { createAppStore } from '../store';
import { clickButton, failingFetch, render } from '../testing';
import AccountDialog, { toAccount } from './AccountDialog';

const draft = { id: 1, userId: 1, name: 'Depot', iban: null };

describe('toAccount', () => {
  it('rejects an invalid IBAN instead of dropping it', () => {
    expect(toAccount({ ...draft, iban: 'DE12 kaputt' })).toBeNull();
  });

  it('normalizes a valid IBAN and turns an empty one into null', () => {
    expect(
      toAccount({ ...draft, iban: ' de89370400440532013000 ' })?.iban
    ).toBe('DE89370400440532013000');
    expect(toAccount({ ...draft, iban: '' })?.iban).toBeNull();
  });
});

describe('the account dialog', () => {
  let cleanup: () => void;
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('stays open with the input and the error when saving fails', async () => {
    vi.stubGlobal('fetch', failingFetch());
    const onClose = vi.fn();
    cleanup = await render(
      <AccountDialog initialAccount={draft} open onClose={onClose} />,
      createAppStore()
    );

    await clickButton('Speichern');

    expect(onClose).not.toHaveBeenCalled();
    expect(document.body.textContent).toContain('Speichern fehlgeschlagen');
    expect(document.body.textContent).toContain('500 Internal Server Error');
    expect(
      document.querySelector<HTMLInputElement>('#account-name')?.value
    ).toBe('Depot');

    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response(null)))
    );
    await clickButton('Speichern');

    expect(onClose).toHaveBeenCalled();
  });
});
