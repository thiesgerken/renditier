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

export const updateTransactions = () => (dispatch, getState) => {
  const { transactions } = getState();

  if (
    transactions.lastUpdated !== null &&
    Date.now() - transactions.lastUpdated > 60 * 60 * 1e3
  )
    dispatch(invalidateTransactions());

  if (
    !transactions.isFetching &&
    ((transactions.lastUpdated === null && transactions.error === null) ||
      transactions.didInvalidate)
  )
    return dispatch(fetchTransactions());

  return Promise.resolve();
};
