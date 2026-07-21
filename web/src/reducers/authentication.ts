import {
  INVALIDATE_LOGIN,
  LOGIN_REQUEST,
  LOGIN_SUCCESS,
  LOGIN_ERROR,
  LOGOUT_REQUEST,
  LOGOUT_SUCCESS,
  LOGOUT_ERROR,
  CLEAR_AUTH_MESSAGE,
} from '../actions/authentication';

import type { AppAction } from '../types/actions';
import type { AuthenticationState, StoredError } from '../types/store';

const formatLoginError = (e: StoredError): string => {
  if (e.message === '401')
    return 'Falsche Kombination aus Benutzername und Passwort!';

  return e.toString();
};

const initialState: AuthenticationState = {
  isFetching: false,
  didInvalidate: false,
  userInfo: null,
  lastUpdated: null,
  error: null,
  message: null,
  messageType: null,
  loginAttempted: false,
};

const authentication = (
  state: AuthenticationState = initialState,
  action: AppAction
): AuthenticationState => {
  switch (action.type) {
    case INVALIDATE_LOGIN:
      return {
        ...state,
        didInvalidate: true,
        messageType: null,
        message: null,
      };
    case LOGIN_REQUEST:
      return {
        ...state,
        isFetching: true,
        messageType: null,
        message: null,
      };
    case LOGIN_SUCCESS:
      return {
        ...state,
        isFetching: false,
        didInvalidate: false,
        userInfo: action.data,
        lastUpdated: action.receivedAt,
        error: null,
        messageType: null,
        message: null,
        loginAttempted: true,
      };
    case LOGIN_ERROR:
      return {
        ...state,
        isFetching: false,
        error: action.error,
        messageType: action.message ? 'error' : state.messageType,
        message: action.message
          ? formatLoginError(action.error)
          : state.message,
        loginAttempted: true,
        userInfo: action.error.message === '401' ? null : state.userInfo,
      };
    case LOGOUT_REQUEST:
      return {
        ...state,
        isFetching: true,
        messageType: null,
        message: null,
      };
    case LOGOUT_SUCCESS:
      return {
        ...state,
        isFetching: false,
        didInvalidate: false,
        userInfo: null,
        lastUpdated: action.receivedAt,
        error: null,
        messageType: 'success',
        message: 'Erfolgreich ausgeloggt.',
      };
    case LOGOUT_ERROR:
      return { ...state, isFetching: false, error: action.error };
    case CLEAR_AUTH_MESSAGE:
      return { ...state, messageType: null, message: null };
    default:
      return state;
  }
};

export default authentication;
