import { createSlice, isFulfilled, isRejected } from '@reduxjs/toolkit';

import { fetchJson, fetchOk } from '../api';
import type { NewTransaction, Transaction } from '../types/api';
import type { TransactionsState } from '../types/store';
import { createAppAsyncThunk } from './createAppAsyncThunk';
import { isOutdated } from './freshness';
import { invalidatePerformance } from './performance';

const initialState: TransactionsState = {
  isFetching: false,
  didInvalidate: false,
  items: [],
  fetchError: null,
  lastUpdated: null,
};

export const fetchTransactions = createAppAsyncThunk(
  'transactions/fetch',
  () => fetchJson<Transaction[]>('/api/transactions'),
  {
    condition: (_, { getState }) => {
      const { transactions } = getState();
      return (
        !transactions.isFetching &&
        ((transactions.lastUpdated === null &&
          transactions.fetchError === null) ||
          transactions.didInvalidate ||
          isOutdated(transactions.lastUpdated))
      );
    },
  }
);

export const createTransaction = createAppAsyncThunk(
  'transactions/create',
  async (transaction: NewTransaction, { dispatch }) => {
    await fetchOk('/api/transactions/', {
      method: 'POST',
      body: JSON.stringify(transaction),
    });
    dispatch(invalidatePerformance());
  }
);

export const updateTransaction = createAppAsyncThunk(
  'transactions/update',
  async (transaction: Transaction, { dispatch }) => {
    await fetchOk(`/api/transactions/${transaction.id}`, {
      method: 'PUT',
      body: JSON.stringify(transaction),
    });
    dispatch(invalidatePerformance());
  }
);

export const deleteTransaction = createAppAsyncThunk(
  'transactions/delete',
  async (id: number, { dispatch }) => {
    await fetchOk(`/api/transactions/${id}`, { method: 'DELETE' });
    dispatch(invalidatePerformance());
  }
);

const modifications = [
  createTransaction,
  updateTransaction,
  deleteTransaction,
] as const;

const transactions = createSlice({
  name: 'transactions',
  initialState,
  reducers: {
    invalidate: state => {
      state.didInvalidate = true;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchTransactions.pending, state => {
        state.isFetching = true;
      })
      .addCase(fetchTransactions.fulfilled, (state, action) => {
        state.isFetching = false;
        state.didInvalidate = false;
        state.items = action.payload;
        state.lastUpdated = Date.now();
        state.fetchError = null;
      })
      .addCase(fetchTransactions.rejected, (state, action) => {
        state.isFetching = false;
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

export default transactions.reducer;
export const { invalidate: invalidateTransactions } = transactions.actions;
