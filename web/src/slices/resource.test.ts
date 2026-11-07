import { createAppStore } from '../store';
import { createAccount, deleteAccount, fetchAccounts } from './accounts';

const account = { id: 7, userId: 1, name: 'Depot', iban: null };

describe('a resource slice with changes', () => {
  it('is outdated once a change settles, failed or not', () => {
    const store = createAppStore();
    store.dispatch(fetchAccounts.fulfilled([account], 'load'));

    store.dispatch(deleteAccount.rejected(new Error('kaputt'), 'delete', 7));
    // The dialog shows the failure; the list's error is about loading it.
    expect(store.getState().accounts).toMatchObject({
      didInvalidate: true,
      error: null,
      data: [account],
    });

    store.dispatch(fetchAccounts.fulfilled([account], 'reload'));
    store.dispatch(createAccount.fulfilled(undefined, 'create', account));
    expect(store.getState().accounts.didInvalidate).toBe(true);
  });

  it('keeps the loaded list when a reload fails', () => {
    const store = createAppStore();
    store.dispatch(fetchAccounts.fulfilled([account], 'load'));
    store.dispatch(fetchAccounts.rejected(new Error('offline'), 'reload'));

    expect(store.getState().accounts.data).toEqual([account]);
  });
});
