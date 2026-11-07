import { createAppStore } from '../store';
import { createAccount, deleteAccount, fetchAccounts } from './accounts';

const account = { id: 7, userId: 1, name: 'Depot', iban: null };

describe('a resource slice with changes', () => {
  it('is outdated once a change settles, and reports a failed one', () => {
    const store = createAppStore();
    store.dispatch(fetchAccounts.fulfilled([account], 'load'));

    store.dispatch(deleteAccount.rejected(new Error('kaputt'), 'delete', 7));
    expect(store.getState().accounts).toMatchObject({
      didInvalidate: true,
      error: { message: 'kaputt' },
      data: [account],
    });

    store.dispatch(fetchAccounts.fulfilled([account], 'reload'));
    store.dispatch(createAccount.fulfilled(undefined, 'create', account));
    expect(store.getState().accounts).toMatchObject({
      didInvalidate: true,
      error: null,
    });
  });

  it('keeps the loaded list when a reload fails', () => {
    const store = createAppStore();
    store.dispatch(fetchAccounts.fulfilled([account], 'load'));
    store.dispatch(fetchAccounts.rejected(new Error('offline'), 'reload'));

    expect(store.getState().accounts.data).toEqual([account]);
  });
});
