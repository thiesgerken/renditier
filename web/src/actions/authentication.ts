import { subscribe } from './notifications';
import { navigateTo } from '../navigation';

import type { UserInfo } from '../types/api';
import type { AppThunk } from '../types/actions';
import type { StoredError, Timestamp } from '../types/store';

// The login/user routes answer with the normal payload plus an `error` key when
// something went wrong server-side.
type UserInfoResponse = UserInfo & { error?: StoredError };

// `logout` tests `res.error` on the unparsed Response rather than on a parsed
// body; a Response never carries that key, so the check never fires. Typed so
// the existing check can be kept verbatim.
type ResponseWithError = Response & { error?: StoredError };

export const LOGIN_REQUEST = 'LOGIN_REQUEST';
export interface LoginRequestAction {
  type: typeof LOGIN_REQUEST;
}
export const loginRequest = (): LoginRequestAction => ({
  type: LOGIN_REQUEST,
});

export const LOGIN_SUCCESS = 'LOGIN_SUCCESS';
export interface LoginSuccessAction {
  type: typeof LOGIN_SUCCESS;
  data: UserInfo;
  receivedAt: Timestamp;
}
export const loginSuccess = (json: UserInfo): LoginSuccessAction => ({
  type: LOGIN_SUCCESS,
  data: json,
  receivedAt: Date.now(),
});

export const LOGIN_ERROR = 'LOGIN_ERROR';
export interface LoginErrorAction {
  type: typeof LOGIN_ERROR;
  error: StoredError;
  receivedAt: Timestamp;
  message: boolean;
}
export const loginError = (
  e: StoredError,
  message = true
): LoginErrorAction => ({
  type: LOGIN_ERROR,
  error: e,
  receivedAt: Date.now(),
  message,
});

export const INVALIDATE_LOGIN = 'INVALIDATE_LOGIN';
export interface InvalidateLoginAction {
  type: typeof INVALIDATE_LOGIN;
}
export const invalidateLogin = (): InvalidateLoginAction => ({
  type: INVALIDATE_LOGIN,
});

export const CLEAR_AUTH_MESSAGE = 'CLEAR_AUTH_MESSAGE';
export interface ClearAuthMessageAction {
  type: typeof CLEAR_AUTH_MESSAGE;
}
export const clearAuthMessage = (): ClearAuthMessageAction => ({
  type: CLEAR_AUTH_MESSAGE,
});

// Everything these chains reject with is either an Error thrown above, a fetch
// network failure, or the `{ message }` payload the API puts in `error`, so the
// rejection value is always a StoredError.
export const login =
  (
    userName: string,
    password: string
  ): AppThunk<Promise<void | LoginErrorAction>> =>
  dispatch => {
    navigateTo('/');
    dispatch(loginRequest());
    return fetch('/api/user/login', {
      method: 'POST',
      body: JSON.stringify({ userName, password }),
    })
      .then(res => {
        if (!res.ok) throw new Error(res.status.toString());
        return res.json() as Promise<UserInfoResponse>;
      })
      .then(res => {
        if (res.error) throw res.error;

        dispatch(loginSuccess(res));
        dispatch(subscribe());
      })
      .catch((e: unknown) => dispatch(loginError(e as StoredError)));
  };

export const checkLogin = (): AppThunk => dispatch =>
  fetch('/api/user')
    .then(res => {
      return res.json() as Promise<UserInfoResponse>;
    })
    .then(res => {
      if (res.redirect) {
        window.location.replace(res.redirect);
      }

      // FIXME(tsx-migration): was `throw new Error(res)` — Error takes a string,
      // so the message was always "[object Object]" and the body was lost.
      if (!res.id && !res.name) throw new Error(JSON.stringify(res));

      dispatch(loginSuccess(res));
      dispatch(subscribe());
    })
    .catch((e: unknown) => {
      dispatch(loginError(e as StoredError, false));
    });

export const LOGOUT_REQUEST = 'LOGOUT_REQUEST';
export interface LogoutRequestAction {
  type: typeof LOGOUT_REQUEST;
}
export const logoutRequest = (): LogoutRequestAction => ({
  type: LOGOUT_REQUEST,
});

export const LOGOUT_SUCCESS = 'LOGOUT_SUCCESS';
export interface LogoutSuccessAction {
  type: typeof LOGOUT_SUCCESS;
  receivedAt: Timestamp;
}
export const logoutSuccess = (): LogoutSuccessAction => ({
  type: LOGOUT_SUCCESS,
  receivedAt: Date.now(),
});

export const LOGOUT_ERROR = 'LOGOUT_ERROR';
export interface LogoutErrorAction {
  type: typeof LOGOUT_ERROR;
  error: StoredError;
  receivedAt: Timestamp;
}
export const logoutError = (e: StoredError): LogoutErrorAction => ({
  type: LOGOUT_ERROR,
  error: e,
  receivedAt: Date.now(),
});

export const logout =
  (): AppThunk<Promise<void | LogoutErrorAction>> => dispatch => {
    dispatch(logoutRequest());
    return fetch(`/api/user/logout`)
      .then((res: ResponseWithError) => {
        if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
        if (res.error) throw res.error;

        dispatch(logoutSuccess());
        navigateTo('/');
      })
      .catch((e: unknown) => dispatch(logoutError(e as StoredError)));
  };

export type AuthenticationAction =
  | LoginRequestAction
  | LoginSuccessAction
  | LoginErrorAction
  | InvalidateLoginAction
  | ClearAuthMessageAction
  | LogoutRequestAction
  | LogoutSuccessAction
  | LogoutErrorAction;
