import {
  INVALIDATE_TRANSACTIONS,
  FETCH_TRANSACTIONS_REQUEST,
  FETCH_TRANSACTIONS_ERROR,
  FETCH_TRANSACTIONS_SUCCESS,
  MODIFY_TRANSACTION_REQUEST,
  MODIFY_TRANSACTION_ERROR,
  MODIFY_TRANSACTION_SUCCESS,
} from '../actions/transactions';

const transactions = (
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
    case INVALIDATE_TRANSACTIONS:
      return { ...state, didInvalidate: true };
    case FETCH_TRANSACTIONS_REQUEST:
      return { ...state, isFetching: true };
    case FETCH_TRANSACTIONS_SUCCESS:
      return {
        ...state,
        isFetching: false,
        didInvalidate: false,
        items: action.data,
        lastUpdated: action.receivedAt,
        fetchError: null,
      };
    case FETCH_TRANSACTIONS_ERROR:
      return {
        ...state,
        isFetching: false,
        items: [],
        fetchError: action.error,
        lastUpdated: action.receivedAt,
      };
    case MODIFY_TRANSACTION_REQUEST:
      return { ...state, isModifying: true };
    case MODIFY_TRANSACTION_SUCCESS:
      return {
        ...state,
        isModifying: false,
        didInvalidate: true,
        fetchError: null,
      };
    case MODIFY_TRANSACTION_ERROR:
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

export default transactions;
