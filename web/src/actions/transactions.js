import { invalidatePerformance } from './api';

export const FETCH_TRANSACTIONS_REQUEST = 'FETCH_TRANSACTIONS_REQUEST';
export const fetchTransactionsRequest = () => ({
  type: FETCH_TRANSACTIONS_REQUEST,
});

export const FETCH_TRANSACTIONS_SUCCESS = 'FETCH_TRANSACTIONS_SUCCESS';
export const fetchTransactionsSuccess = json => ({
  type: FETCH_TRANSACTIONS_SUCCESS,
  data: json,
  receivedAt: Date.now(),
});

export const FETCH_TRANSACTIONS_ERROR = 'FETCH_TRANSACTIONS_ERROR';
export const fetchTransactionsError = e => ({
  type: FETCH_TRANSACTIONS_ERROR,
  error: e,
  receivedAt: Date.now(),
});

export const INVALIDATE_TRANSACTIONS = 'INVALIDATE_TRANSACTIONS';
export const invalidateTransactions = () => ({
  type: INVALIDATE_TRANSACTIONS,
});

export const MODIFY_TRANSACTION_REQUEST = 'MODIFY_TRANSACTION_REQUEST';
export const modifyTransactionRequest = (id, method) => ({
  type: MODIFY_TRANSACTION_REQUEST,
  id,
  method,
});

export const MODIFY_TRANSACTION_SUCCESS = 'MODIFY_TRANSACTION_SUCCESS';
export const modifyTransactionSuccess = (id, method) => ({
  type: MODIFY_TRANSACTION_SUCCESS,
  id,
  method,
  receivedAt: Date.now(),
});

export const MODIFY_TRANSACTION_ERROR = 'MODIFY_TRANSACTION_ERROR';
export const modifyTransactionError = (id, method, error) => ({
  type: MODIFY_TRANSACTION_ERROR,
  id,
  method,
  error,
  receivedAt: Date.now(),
});

export const fetchTransactions = () => dispatch => {
  dispatch(fetchTransactionsRequest());
  return fetch('/api/transactions')
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res.json();
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(fetchTransactionsSuccess(res));
    })
    .catch(e => dispatch(fetchTransactionsError(e)));
};

export const deleteTransaction = id => dispatch => {
  dispatch(modifyTransactionRequest(id, 'DELETE'));
  return fetch(`/api/transactions/${id}`, { method: 'DELETE' })
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res;
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(modifyTransactionSuccess(id, 'DELETE', null));
      dispatch(invalidatePerformance());
    })
    .catch(e => dispatch(modifyTransactionError(id, 'DELETE', e)));
};

export const createTransaction = transaction => dispatch => {
  dispatch(modifyTransactionRequest(null, 'POST'));
  return fetch(`/api/transactions/`, {
    method: 'POST',
    body: JSON.stringify(transaction),
  })
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res.json();
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(modifyTransactionSuccess(res.id, 'POST', res));
      dispatch(invalidatePerformance());
    })
    .catch(e => dispatch(modifyTransactionError(null, 'POST', e)));
};

export const updateTransaction = transaction => dispatch => {
  dispatch(modifyTransactionRequest(transaction.id, 'PUT'));
  return fetch(`/api/transactions/${transaction.id}`, {
    method: 'PUT',
    body: JSON.stringify(transaction),
  })
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res;
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(modifyTransactionSuccess(transaction.id, 'PUT', null));
      dispatch(invalidatePerformance());
    })
    .catch(e => dispatch(modifyTransactionError(transaction.id, 'PUT', e)));
};

export const updateTransactions = () => (dispatch, getState) => {
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
