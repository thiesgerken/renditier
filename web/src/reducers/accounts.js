import {
  INVALIDATE_ACCOUNTS,
  FETCH_ACCOUNTS_REQUEST,
  FETCH_ACCOUNTS_ERROR,
  FETCH_ACCOUNTS_SUCCESS,
} from '../actions/accounts';

const accounts = (
  state = {
    isFetching: false,
    didInvalidate: false,
    items: [],
    error: null,
    lastUpdated: null,
  },
  action
) => {
  switch (action.type) {
    case INVALIDATE_ACCOUNTS:
      return { ...state, didInvalidate: true };
    case FETCH_ACCOUNTS_REQUEST:
      return { ...state, isFetching: true };
    case FETCH_ACCOUNTS_SUCCESS:
      return {
        ...state,
        isFetching: false,
        didInvalidate: false,
        items: action.data,
        lastUpdated: action.receivedAt,
        error: null,
      };
    case FETCH_ACCOUNTS_ERROR:
      return {
        ...state,
        isFetching: false,
        items: [],
        error: action.error,
        lastUpdated: action.receivedAt,
      };
    default:
      return state;
  }
};

export default accounts;
