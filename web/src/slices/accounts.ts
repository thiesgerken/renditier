import { fetchOk } from '../api';
import type { Account, NewAccount } from '../types/api';
import { createAppAsyncThunk } from './createAppAsyncThunk';
import { invalidatePerformance } from './performance';
import { createResourceSlice } from './resource';
import type { Resource } from './resource';
import { invalidateTransactions } from './transactions';

export const createAccount = createAppAsyncThunk(
  'accounts/create',
  async (account: NewAccount) => {
    await fetchOk('/api/accounts/', {
      method: 'POST',
      body: JSON.stringify(account),
    });
  }
);

export const updateAccount = createAppAsyncThunk(
  'accounts/update',
  async (account: Account) => {
    await fetchOk(`/api/accounts/${account.id}`, {
      method: 'PUT',
      body: JSON.stringify(account),
    });
  }
);

export const deleteAccount = createAppAsyncThunk(
  'accounts/delete',
  async (id: number, { dispatch }) => {
    await fetchOk(`/api/accounts/${id}`, { method: 'DELETE' });
    dispatch(invalidatePerformance());
    dispatch(invalidateTransactions());
  }
);

// Annotated: the change thunks' types depend on RootState, which in turn is
// inferred from this reducer.
const accounts: Resource<Account[]> = createResourceSlice(
  'accounts',
  '/api/accounts',
  [createAccount, updateAccount, deleteAccount]
);

export default accounts.reducer;
export const fetchAccounts = accounts.fetch;
