import { createSlice, isFulfilled, isRejected } from '@reduxjs/toolkit';

import { fetchJson, fetchOk } from '../api';
import type { Account, NewAccount } from '../types/api';
import type { AccountsState } from '../types/store';
import { createAppAsyncThunk } from './createAppAsyncThunk';
import { needsFetch } from './freshness';
import { invalidatePerformance } from './performance';
import { invalidateTransactions } from './transactions';

const initialState: AccountsState = {
  isFetching: false,
  didInvalidate: false,
  items: [],
  fetchError: null,
  lastUpdated: null,
};

export const fetchAccounts = createAppAsyncThunk(
  'accounts/fetch',
  () => fetchJson<Account[]>('/api/accounts'),
  {
    condition: (_, { getState }) => needsFetch(getState().accounts),
  }
);

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

const modifications = [createAccount, updateAccount, deleteAccount] as const;

const accounts = createSlice({
  name: 'accounts',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchAccounts.pending, state => {
        state.isFetching = true;
      })
      .addCase(fetchAccounts.fulfilled, (state, action) => {
        state.isFetching = false;
        state.didInvalidate = false;
        state.items = action.payload;
        state.lastUpdated = Date.now();
        state.fetchError = null;
      })
      .addCase(fetchAccounts.rejected, (state, action) => {
        state.isFetching = false;
        state.didInvalidate = false;
        state.items = [];
        state.fetchError = action.error;
        state.lastUpdated = Date.now();
      })
      .addMatcher(isFulfilled(...modifications), state => {
        state.didInvalidate = true;
        state.fetchError = null;
      })
      // A failed change is reported through `fetchError` like a failed load.
      .addMatcher(isRejected(...modifications), (state, action) => {
        state.didInvalidate = true;
        state.fetchError = action.error;
      });
  },
});

export default accounts.reducer;
