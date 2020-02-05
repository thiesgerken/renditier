import {
  INVALIDATE_LOGIN,
  LOGIN_REQUEST,
  LOGIN_SUCCESS,
  LOGIN_ERROR,
  LOGOUT_REQUEST,
  LOGOUT_SUCCESS,
  LOGOUT_ERROR,
} from '../actions/authentication';

const authentication = (
  state = {
    isFetching: false,
    didInvalidate: false,
    userInfo: null,
    lastUpdated: null,
  },
  action
) => {
  switch (action.type) {
    case INVALIDATE_LOGIN:
      return { ...state, didInvalidate: true };
    case LOGIN_REQUEST:
      return { ...state, isFetching: true, didInvalidate: false };
    case LOGIN_SUCCESS:
      return {
        ...state,
        isFetching: false,
        didInvalidate: false,
        userInfo: action.data,
        lastUpdated: action.receivedAt,
      };
    case LOGIN_ERROR:
      return { ...state, isFetching: false };
    case LOGOUT_REQUEST:
      return { ...state, isFetching: true, didInvalidate: false };
    case LOGOUT_SUCCESS:
      return {
        ...state,
        isFetching: false,
        didInvalidate: false,
        userInfo: null,
        lastUpdated: action.receivedAt,
      };
    case LOGOUT_ERROR:
      return { ...state, isFetching: false };
    default:
      return state;
  }
};

export default authentication;
