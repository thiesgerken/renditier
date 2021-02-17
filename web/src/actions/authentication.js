import { push } from 'connected-react-router';
import { subscribe } from './notifications';

export const LOGIN_REQUEST = 'LOGIN_REQUEST';
export const loginRequest = () => ({
  type: LOGIN_REQUEST,
});

export const LOGIN_SUCCESS = 'LOGIN_SUCCESS';
export const loginSuccess = json => ({
  type: LOGIN_SUCCESS,
  data: json,
  receivedAt: Date.now(),
});

export const LOGIN_ERROR = 'LOGIN_ERROR';
export const loginError = (e, message = true) => ({
  type: LOGIN_ERROR,
  error: e,
  receivedAt: Date.now(),
  message,
});

export const INVALIDATE_LOGIN = 'INVALIDATE_LOGIN';
export const invalidateLogin = () => ({
  type: INVALIDATE_LOGIN,
});

export const CLEAR_AUTH_MESSAGE = 'CLEAR_AUTH_MESSAGE';
export const clearAuthMessage = () => ({
  type: CLEAR_AUTH_MESSAGE,
});

export const login = (userName, password) => dispatch => {
  dispatch(push('/'));
  dispatch(loginRequest());
  return fetch('/api/user/login', {
    method: 'POST',
    body: JSON.stringify({ userName, password }),
  })
    .then(res => {
      if (!res.ok) throw Error(res.status.toString());
      return res.json();
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(loginSuccess(res));
      dispatch(subscribe());
    })
    .catch(e => dispatch(loginError(e)));
};

export const checkLogin = () => dispatch =>
  fetch('/api/user')
    .then(res => {
      if (!res.ok) throw Error(res.status.toString());
      return res.json();
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(loginSuccess(res));
      dispatch(subscribe());
    })
    .catch(e => {
      dispatch(loginError(e, false));
    });

export const LOGOUT_REQUEST = 'LOGOUT_REQUEST';
export const logoutRequest = () => ({
  type: LOGOUT_REQUEST,
});

export const LOGOUT_SUCCESS = 'LOGOUT_SUCCESS';
export const logoutSuccess = () => ({
  type: LOGOUT_SUCCESS,
  receivedAt: Date.now(),
});

export const LOGOUT_ERROR = 'LOGOUT_ERROR';
export const logoutError = e => ({
  type: LOGOUT_ERROR,
  error: e,
  receivedAt: Date.now(),
});

export const logout = () => dispatch => {
  dispatch(logoutRequest());
  return fetch(`/api/user/logout`)
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      if (res.error) throw res.error;

      dispatch(logoutSuccess());
      dispatch(push('/'));
    })
    .catch(e => dispatch(logoutError(e)));
};
