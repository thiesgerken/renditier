export const FETCH_ACCOUNTS_REQUEST = 'FETCH_ACCOUNTS_REQUEST';
export const fetchAccountsRequest = () => ({
  type: FETCH_ACCOUNTS_REQUEST,
});

export const FETCH_ACCOUNTS_SUCCESS = 'FETCH_ACCOUNTS_SUCCESS';
export const fetchAccountsSuccess = json => ({
  type: FETCH_ACCOUNTS_SUCCESS,
  data: json,
  receivedAt: Date.now(),
});

export const FETCH_ACCOUNTS_ERROR = 'FETCH_ACCOUNTS_ERROR';
export const fetchAccountsError = e => ({
  type: FETCH_ACCOUNTS_ERROR,
  error: e,
  receivedAt: Date.now(),
});

export const INVALIDATE_ACCOUNTS = 'INVALIDATE_ACCOUNTS';
export const invalidateAccounts = () => ({
  type: INVALIDATE_ACCOUNTS,
});

export const fetchAccounts = () => dispatch => {
  dispatch(fetchAccountsRequest());
  return fetch('/api/accounts')
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res.json();
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(fetchAccountsSuccess(res));
    })
    .catch(e => dispatch(fetchAccountsError(e)));
};

export const updateAccounts = () => (dispatch, getState) => {
  const { accounts } = getState();

  if (
    accounts.lastUpdated !== null &&
    Date.now() - accounts.lastUpdated > 60 * 60 * 1e3
  )
    dispatch(invalidateAccounts());

  if (
    !accounts.isFetching &&
    ((accounts.lastUpdated === null && accounts.error === null) ||
      accounts.didInvalidate)
  )
    return dispatch(fetchAccounts());

  return Promise.resolve();
};
