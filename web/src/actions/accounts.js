import { invalidatePerformance } from './api';
import { invalidateTransactions } from './transactions';

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

export const MODIFY_ACCOUNT_REQUEST = 'MODIFY_ACCOUNT_REQUEST';
export const modifyAccountRequest = (id, method) => ({
  type: MODIFY_ACCOUNT_REQUEST,
  id,
  method,
});

export const MODIFY_ACCOUNT_SUCCESS = 'MODIFY_ACCOUNT_SUCCESS';
export const modifyAccountSuccess = (id, method) => ({
  type: MODIFY_ACCOUNT_SUCCESS,
  id,
  method,
  receivedAt: Date.now(),
});

export const MODIFY_ACCOUNT_ERROR = 'MODIFY_ACCOUNT_ERROR';
export const modifyAccountError = (id, method, error) => ({
  type: MODIFY_ACCOUNT_ERROR,
  id,
  method,
  error,
  receivedAt: Date.now(),
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
    !accounts.didInvalidate &&
    accounts.lastUpdated !== null &&
    Date.now() - accounts.lastUpdated > 60 * 60 * 1e3
  )
    dispatch(invalidateAccounts());

  if (
    !accounts.isFetching &&
    ((accounts.lastUpdated === null && accounts.fetchError === null) ||
      accounts.didInvalidate)
  )
    return dispatch(fetchAccounts());

  return Promise.resolve();
};

export const deleteAccount = id => dispatch => {
  dispatch(modifyAccountRequest(id, 'DELETE'));
  return fetch(`/api/accounts/${id}`, { method: 'DELETE' })
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res;
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(modifyAccountSuccess(id, 'DELETE', null));
      dispatch(invalidatePerformance());
      dispatch(invalidateTransactions());
    })
    .catch(e => dispatch(modifyAccountError(id, 'DELETE', e)));
};

export const createAccount = account => dispatch => {
  dispatch(modifyAccountRequest(null, 'POST'));
  return fetch(`/api/accounts/`, {
    method: 'POST',
    body: JSON.stringify(account),
  })
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res.json();
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(modifyAccountSuccess(res.id, 'POST', res));
    })
    .catch(e => dispatch(modifyAccountError(null, 'POST', e)));
};

export const updateAccount = account => dispatch => {
  dispatch(modifyAccountRequest(account.id, 'PUT'));
  return fetch(`/api/accounts/${account.id}`, {
    method: 'PUT',
    body: JSON.stringify(account),
  })
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res;
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(modifyAccountSuccess(account.id, 'PUT', null));
    })
    .catch(e => dispatch(modifyAccountError(account.id, 'PUT', e)));
};
