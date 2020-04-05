import {
  INVALIDATE_TRANSACTIONS,
  FETCH_TRANSACTIONS_REQUEST,
  FETCH_TRANSACTIONS_ERROR,
  FETCH_TRANSACTIONS_SUCCESS,
} from '../actions/transactions';

const transactions = (
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
    case INVALIDATE_TRANSACTIONS:
      return { ...state, didInvalidate: true };
    case FETCH_TRANSACTIONS_REQUEST:
      return { ...state, isFetching: true, didInvalidate: false };
    case FETCH_TRANSACTIONS_SUCCESS:
      return {
        ...state,
        isFetching: false,
        didInvalidate: false,
        items: action.data,
        lastUpdated: action.receivedAt,
        error: null,
      };
    case FETCH_TRANSACTIONS_ERROR:
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

export default transactions;
