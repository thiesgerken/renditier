import { fetchOk } from '../api';
import type { NewTransaction, Transaction } from '../types/api';
import { createAppAsyncThunk } from './createAppAsyncThunk';
import { invalidatePerformance } from './performance';
import { createResourceSlice } from './resource';
import type { Resource } from './resource';

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

// Annotated: the change thunks' types depend on RootState, which in turn is
// inferred from this reducer.
const transactions: Resource<Transaction[]> = createResourceSlice(
  'transactions',
  '/api/transactions',
  [createTransaction, updateTransaction, deleteTransaction]
);

export default transactions.reducer;
export const fetchTransactions = transactions.fetch;
export const invalidateTransactions = transactions.invalidate;
