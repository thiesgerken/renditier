import { invalidatePerformance } from './api';
import { invalidateTransactions } from './transactions';

import type { AppThunk } from '../types/actions';
import type { Account, NewAccount } from '../types/api';
import type { ModifyMethod, StoredError, Timestamp } from '../types/store';

export const FETCH_ACCOUNTS_REQUEST = 'FETCH_ACCOUNTS_REQUEST';
export interface FetchAccountsRequestAction {
  type: typeof FETCH_ACCOUNTS_REQUEST;
}
export const fetchAccountsRequest = (): FetchAccountsRequestAction => ({
  type: FETCH_ACCOUNTS_REQUEST,
});

export const FETCH_ACCOUNTS_SUCCESS = 'FETCH_ACCOUNTS_SUCCESS';
export interface FetchAccountsSuccessAction {
  type: typeof FETCH_ACCOUNTS_SUCCESS;
  data: Account[];
  receivedAt: Timestamp;
}
export const fetchAccountsSuccess = (
  json: Account[]
): FetchAccountsSuccessAction => ({
  type: FETCH_ACCOUNTS_SUCCESS,
  data: json,
  receivedAt: Date.now(),
});

export const FETCH_ACCOUNTS_ERROR = 'FETCH_ACCOUNTS_ERROR';
export interface FetchAccountsErrorAction {
  type: typeof FETCH_ACCOUNTS_ERROR;
  error: StoredError;
  receivedAt: Timestamp;
}
export const fetchAccountsError = (
  e: StoredError
): FetchAccountsErrorAction => ({
  type: FETCH_ACCOUNTS_ERROR,
  error: e,
  receivedAt: Date.now(),
});

export const INVALIDATE_ACCOUNTS = 'INVALIDATE_ACCOUNTS';
export interface InvalidateAccountsAction {
  type: typeof INVALIDATE_ACCOUNTS;
}
export const invalidateAccounts = (): InvalidateAccountsAction => ({
  type: INVALIDATE_ACCOUNTS,
});

export const MODIFY_ACCOUNT_REQUEST = 'MODIFY_ACCOUNT_REQUEST';
export interface ModifyAccountRequestAction {
  type: typeof MODIFY_ACCOUNT_REQUEST;
  // null while a POST is in flight — the account has no id yet.
  id: number | null;
  method: ModifyMethod;
}
export const modifyAccountRequest = (
  id: number | null,
  method: ModifyMethod
): ModifyAccountRequestAction => ({
  type: MODIFY_ACCOUNT_REQUEST,
  id,
  method,
});

export const MODIFY_ACCOUNT_SUCCESS = 'MODIFY_ACCOUNT_SUCCESS';
export interface ModifyAccountSuccessAction {
  type: typeof MODIFY_ACCOUNT_SUCCESS;
  id: number | null;
  method: ModifyMethod;
  receivedAt: Timestamp;
}
// Call sites pass the modified account (or null) as a third argument; it has
// never been put on the action, so the parameter is declared and ignored.
export const modifyAccountSuccess = (
  id: number | null,
  method: ModifyMethod,
  _data?: Account | null
): ModifyAccountSuccessAction => ({
  type: MODIFY_ACCOUNT_SUCCESS,
  id,
  method,
  receivedAt: Date.now(),
});

export const MODIFY_ACCOUNT_ERROR = 'MODIFY_ACCOUNT_ERROR';
export interface ModifyAccountErrorAction {
  type: typeof MODIFY_ACCOUNT_ERROR;
  id: number | null;
  method: ModifyMethod;
  error: StoredError;
  receivedAt: Timestamp;
}
export const modifyAccountError = (
  id: number | null,
  method: ModifyMethod,
  error: StoredError
): ModifyAccountErrorAction => ({
  type: MODIFY_ACCOUNT_ERROR,
  id,
  method,
  error,
  receivedAt: Date.now(),
});

export type AccountsAction =
  | FetchAccountsRequestAction
  | FetchAccountsSuccessAction
  | FetchAccountsErrorAction
  | InvalidateAccountsAction
  | ModifyAccountRequestAction
  | ModifyAccountSuccessAction
  | ModifyAccountErrorAction;

export const fetchAccounts = (): AppThunk => dispatch => {
  dispatch(fetchAccountsRequest());
  return fetch('/api/accounts')
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res.json() as Promise<Account[] & { error?: StoredError }>;
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(fetchAccountsSuccess(res));
    })
    .catch((e: StoredError) => {
      dispatch(fetchAccountsError(e));
    });
};

export const updateAccounts = (): AppThunk => (dispatch, getState) => {
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

export const deleteAccount =
  (id: number): AppThunk =>
  dispatch => {
    dispatch(modifyAccountRequest(id, 'DELETE'));
    return fetch(`/api/accounts/${id}`, { method: 'DELETE' })
      .then(res => {
        if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
        return res;
      })
      .then(() => {
        // FIXME(tsx-migration): dropped a dead `if (res.error) throw res.error`
        // here — this branch never parsed the body, so `res` was a Response and
        // `res.error` was always undefined. A failed DELETE throws above already.
        dispatch(modifyAccountSuccess(id, 'DELETE', null));
        dispatch(invalidatePerformance());
        dispatch(invalidateTransactions());
      })
      .catch((e: StoredError) => {
        dispatch(modifyAccountError(id, 'DELETE', e));
      });
  };

export const createAccount =
  (account: NewAccount): AppThunk =>
  dispatch => {
    dispatch(modifyAccountRequest(null, 'POST'));
    return fetch(`/api/accounts/`, {
      method: 'POST',
      body: JSON.stringify(account),
    })
      .then(res => {
        if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<Account & { error?: StoredError }>;
      })
      .then(res => {
        if (res.error) throw res.error;

        dispatch(modifyAccountSuccess(res.id, 'POST', res));
      })
      .catch((e: StoredError) => {
        dispatch(modifyAccountError(null, 'POST', e));
      });
  };

export const updateAccount =
  (account: Account): AppThunk =>
  dispatch => {
    dispatch(modifyAccountRequest(account.id, 'PUT'));
    return fetch(`/api/accounts/${account.id}`, {
      method: 'PUT',
      body: JSON.stringify(account),
    })
      .then(res => {
        if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
        return res;
      })
      .then(() => {
        // FIXME(tsx-migration): dropped a dead `if (res.error) throw res.error`
        // here — this branch never parsed the body, so `res` was a Response and
        // `res.error` was always undefined. A failed PUT throws above already.
        dispatch(modifyAccountSuccess(account.id, 'PUT', null));
      })
      .catch((e: StoredError) => {
        dispatch(modifyAccountError(account.id, 'PUT', e));
      });
  };
