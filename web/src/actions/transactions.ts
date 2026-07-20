import { invalidatePerformance } from './api';

import type { AppThunk } from '../types/actions';
import type { NewTransaction, Transaction } from '../types/api';
import type { ModifyMethod, StoredError, Timestamp } from '../types/store';

export const FETCH_TRANSACTIONS_REQUEST = 'FETCH_TRANSACTIONS_REQUEST';
export interface FetchTransactionsRequestAction {
  type: typeof FETCH_TRANSACTIONS_REQUEST;
}
export const fetchTransactionsRequest = (): FetchTransactionsRequestAction => ({
  type: FETCH_TRANSACTIONS_REQUEST,
});

export const FETCH_TRANSACTIONS_SUCCESS = 'FETCH_TRANSACTIONS_SUCCESS';
export interface FetchTransactionsSuccessAction {
  type: typeof FETCH_TRANSACTIONS_SUCCESS;
  data: Transaction[];
  receivedAt: Timestamp;
}
export const fetchTransactionsSuccess = (
  json: Transaction[]
): FetchTransactionsSuccessAction => ({
  type: FETCH_TRANSACTIONS_SUCCESS,
  data: json,
  receivedAt: Date.now(),
});

export const FETCH_TRANSACTIONS_ERROR = 'FETCH_TRANSACTIONS_ERROR';
export interface FetchTransactionsErrorAction {
  type: typeof FETCH_TRANSACTIONS_ERROR;
  error: StoredError;
  receivedAt: Timestamp;
}
export const fetchTransactionsError = (
  e: StoredError
): FetchTransactionsErrorAction => ({
  type: FETCH_TRANSACTIONS_ERROR,
  error: e,
  receivedAt: Date.now(),
});

export const INVALIDATE_TRANSACTIONS = 'INVALIDATE_TRANSACTIONS';
export interface InvalidateTransactionsAction {
  type: typeof INVALIDATE_TRANSACTIONS;
}
export const invalidateTransactions = (): InvalidateTransactionsAction => ({
  type: INVALIDATE_TRANSACTIONS,
});

export const MODIFY_TRANSACTION_REQUEST = 'MODIFY_TRANSACTION_REQUEST';
export interface ModifyTransactionRequestAction {
  type: typeof MODIFY_TRANSACTION_REQUEST;
  // null while a POST is in flight — the transaction has no id yet.
  id: number | null;
  method: ModifyMethod;
}
export const modifyTransactionRequest = (
  id: number | null,
  method: ModifyMethod
): ModifyTransactionRequestAction => ({
  type: MODIFY_TRANSACTION_REQUEST,
  id,
  method,
});

export const MODIFY_TRANSACTION_SUCCESS = 'MODIFY_TRANSACTION_SUCCESS';
export interface ModifyTransactionSuccessAction {
  type: typeof MODIFY_TRANSACTION_SUCCESS;
  id: number | null;
  method: ModifyMethod;
  receivedAt: Timestamp;
}
// Call sites pass the modified transaction (or null) as a third argument; it has
// never been put on the action, so the parameter is declared and ignored.
export const modifyTransactionSuccess = (
  id: number | null,
  method: ModifyMethod,
  _data?: Transaction | null
): ModifyTransactionSuccessAction => ({
  type: MODIFY_TRANSACTION_SUCCESS,
  id,
  method,
  receivedAt: Date.now(),
});

export const MODIFY_TRANSACTION_ERROR = 'MODIFY_TRANSACTION_ERROR';
export interface ModifyTransactionErrorAction {
  type: typeof MODIFY_TRANSACTION_ERROR;
  id: number | null;
  method: ModifyMethod;
  error: StoredError;
  receivedAt: Timestamp;
}
export const modifyTransactionError = (
  id: number | null,
  method: ModifyMethod,
  error: StoredError
): ModifyTransactionErrorAction => ({
  type: MODIFY_TRANSACTION_ERROR,
  id,
  method,
  error,
  receivedAt: Date.now(),
});

export type TransactionsAction =
  | FetchTransactionsRequestAction
  | FetchTransactionsSuccessAction
  | FetchTransactionsErrorAction
  | InvalidateTransactionsAction
  | ModifyTransactionRequestAction
  | ModifyTransactionSuccessAction
  | ModifyTransactionErrorAction;

export const fetchTransactions = (): AppThunk => dispatch => {
  dispatch(fetchTransactionsRequest());
  return fetch('/api/transactions')
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res.json() as Promise<Transaction[] & { error?: StoredError }>;
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(fetchTransactionsSuccess(res));
    })
    .catch((e: StoredError) => {
      dispatch(fetchTransactionsError(e));
    });
};

export const deleteTransaction =
  (id: number): AppThunk =>
  dispatch => {
    dispatch(modifyTransactionRequest(id, 'DELETE'));
    return fetch(`/api/transactions/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
        return res;
      })
      .then(() => {
        // FIXME(tsx-migration): dropped a dead `if (res.error) throw res.error`
        // here — this branch never parsed the body, so `res` was a Response and
        // `res.error` was always undefined. A failed DELETE throws above already.
        dispatch(modifyTransactionSuccess(id, 'DELETE', null));
        dispatch(invalidatePerformance());
      })
      .catch((e: StoredError) => {
        dispatch(modifyTransactionError(id, 'DELETE', e));
      });
  };

export const createTransaction =
  (transaction: NewTransaction): AppThunk =>
  dispatch => {
    dispatch(modifyTransactionRequest(null, 'POST'));
    return fetch(`/api/transactions/`, {
      method: 'POST',
      body: JSON.stringify(transaction),
    })
      .then(res => {
        if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<Transaction & { error?: StoredError }>;
      })
      .then(res => {
        if (res.error) throw res.error;

        dispatch(modifyTransactionSuccess(res.id, 'POST', res));
        dispatch(invalidatePerformance());
      })
      .catch((e: StoredError) => {
        dispatch(modifyTransactionError(null, 'POST', e));
      });
  };

export const updateTransaction =
  (transaction: Transaction): AppThunk =>
  dispatch => {
    dispatch(modifyTransactionRequest(transaction.id, 'PUT'));
    return fetch(`/api/transactions/${transaction.id}`, {
      method: 'PUT',
      body: JSON.stringify(transaction),
    })
      .then(res => {
        if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
        return res;
      })
      .then(() => {
        // FIXME(tsx-migration): dropped a dead `if (res.error) throw res.error`
        // here — this branch never parsed the body, so `res` was a Response and
        // `res.error` was always undefined. A failed PUT throws above already.
        dispatch(modifyTransactionSuccess(transaction.id, 'PUT', null));
        dispatch(invalidatePerformance());
      })
      .catch((e: StoredError) => {
        dispatch(modifyTransactionError(transaction.id, 'PUT', e));
      });
  };

export const updateTransactions = (): AppThunk => (dispatch, getState) => {
  const { transactions } = getState();

  if (
    !transactions.didInvalidate &&
    transactions.lastUpdated !== null &&
    Date.now() - transactions.lastUpdated > 60 * 60 * 1e3
  )
    dispatch(invalidateTransactions());

  if (
    !transactions.isFetching &&
    ((transactions.lastUpdated === null && transactions.fetchError === null) ||
      transactions.didInvalidate)
  )
    return dispatch(fetchTransactions());

  return Promise.resolve();
};
