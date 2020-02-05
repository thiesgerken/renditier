export const LOGIN_REQUEST = 'LOGIN_REQUEST';
export const loginRequest = () => ({
  type: LOGIN_REQUEST,
});

export const LOGIN_SUCCESS = 'LOGIN_SUCCESS';
export const loginSuccess = json => ({
  type: LOGIN_SUCCESS,
  data: json, // .data.children.map(child => child.data),
  receivedAt: Date.now(),
});

export const LOGIN_ERROR = 'LOGIN_ERROR';
export const loginError = e => ({
  type: LOGIN_ERROR,
  error: e,
});

export const INVALIDATE_LOGIN = 'INVALIDATE_LOGIN';
export const invalidateLogin = () => ({
  type: INVALIDATE_LOGIN,
});

export const login = (user, password) => dispatch => {
  dispatch(loginRequest());
  return fetch(`/api/user/login?username=${user}&password=${password}`)
    .then(res => res.json())
    .then(res => {
      if (res.error) throw res.error;

      dispatch(loginSuccess(res));
    })
    .catch(e => dispatch(loginError(e)));
};

export const checkLogin = () => dispatch => {
  dispatch(loginRequest());
  return fetch('/api/user')
    .then(res => res.json())
    .then(res => {
      if (res.error) throw res.error;

      dispatch(loginSuccess(res));
    })
    .catch(e => dispatch(loginError(e)));
};

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
});

export const logout = () => dispatch => {
  dispatch(logoutRequest());
  return fetch(`/api/user/logout`)
    .then(res => res.json())
    .then(res => {
      if (res.error) throw res.error;

      dispatch(logoutSuccess(res));
    })
    .catch(e => dispatch(logoutError(e)));
};
