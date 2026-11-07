import { createSlice, isFulfilled } from '@reduxjs/toolkit';
import type { SerializedError } from '@reduxjs/toolkit';

import { fetchOk } from '../api';
import { navigateTo } from '../navigation';
import type { LoginData, UserInfo } from '../types/api';
import type { AuthenticationState } from '../types/store';
import { createAppAsyncThunk } from './createAppAsyncThunk';

const WRONG_CREDENTIALS = '401';

const initialState: AuthenticationState = {
  isFetching: false,
  userInfo: null,
  error: null,
  message: null,
  messageType: null,
  loginAttempted: false,
};

export const login = createAppAsyncThunk(
  'authentication/login',
  async (credentials: LoginData) => {
    navigateTo('/');
    const response = await fetch('/api/user/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    });
    // The bare status, so that the reducer can recognise wrong credentials.
    if (!response.ok) throw new Error(response.status.toString());
    return (await response.json()) as UserInfo;
  }
);

export const checkLogin = createAppAsyncThunk(
  'authentication/check',
  async () => {
    const response = await fetch('/api/user');
    const userInfo = (await response.json()) as UserInfo;

    if (userInfo.redirect) window.location.replace(userInfo.redirect);
    if (!userInfo.id && !userInfo.name)
      throw new Error(JSON.stringify(userInfo));

    return userInfo;
  }
);

export const logout = createAppAsyncThunk('authentication/logout', async () => {
  await fetchOk('/api/user/logout');
});

const loginFailed = (
  state: AuthenticationState,
  error: SerializedError
): void => {
  state.isFetching = false;
  state.error = error;
  state.loginAttempted = true;
  if (error.message === WRONG_CREDENTIALS) state.userInfo = null;
};

const authentication = createSlice({
  name: 'authentication',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(login.pending, state => {
        state.isFetching = true;
        state.messageType = null;
        state.message = null;
      })
      .addCase(login.rejected, (state, action) => {
        loginFailed(state, action.error);
        state.messageType = 'error';
        state.message =
          action.error.message === WRONG_CREDENTIALS
            ? 'Falsche Kombination aus Benutzername und Passwort!'
            : (action.error.message ?? null);
      })
      // Only a login the user started reports its failure on the login page.
      .addCase(checkLogin.rejected, (state, action) => {
        loginFailed(state, action.error);
      })
      .addCase(logout.pending, state => {
        state.isFetching = true;
        state.messageType = null;
        state.message = null;
      })
      .addCase(logout.fulfilled, state => {
        state.isFetching = false;
        state.userInfo = null;
        state.error = null;
        state.messageType = 'success';
        state.message = 'Erfolgreich ausgeloggt.';
      })
      .addCase(logout.rejected, (state, action) => {
        state.isFetching = false;
        state.error = action.error;
      })
      .addMatcher(isFulfilled(login, checkLogin), (state, action) => {
        state.isFetching = false;
        state.userInfo = action.payload;
        state.error = null;
        state.messageType = null;
        state.message = null;
        state.loginAttempted = true;
      });
  },
});

export default authentication.reducer;
