import {
  INVALIDATE_ACCOUNTS,
  FETCH_ACCOUNTS_REQUEST,
  FETCH_ACCOUNTS_ERROR,
  FETCH_ACCOUNTS_SUCCESS,
  MODIFY_ACCOUNT_REQUEST,
  MODIFY_ACCOUNT_ERROR,
  MODIFY_ACCOUNT_SUCCESS,
} from '../actions/accounts';

const accounts = (
  state = {
    isFetching: false,
    didInvalidate: false,
    items: [],
    fetchError: null,
    lastUpdated: null,
    isModifying: false,
    modifyError: null,
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
        fetchError: null,
      };
    case FETCH_ACCOUNTS_ERROR:
      return {
        ...state,
        isFetching: false,
        items: [],
        fetchError: action.error,
        lastUpdated: action.receivedAt,
      };
    case MODIFY_ACCOUNT_REQUEST:
      return { ...state, isModifying: true };
    case MODIFY_ACCOUNT_SUCCESS:
      return {
        ...state,
        isModifying: false,
        didInvalidate: true,
        fetchError: null,
      };
    case MODIFY_ACCOUNT_ERROR:
      return {
        ...state,
        isModifying: false,
        didInvalidate: true,
        fetchError: action.error,
      };
    default:
      return state;
  }
};

export default accounts;
