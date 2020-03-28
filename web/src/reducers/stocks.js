import {
  INVALIDATE_STOCKS,
  FETCH_STOCKS_REQUEST,
  FETCH_STOCKS_ERROR,
  FETCH_STOCKS_SUCCESS,
} from '../actions/stocks';

const stocks = (
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
    case INVALIDATE_STOCKS:
      return { ...state, didInvalidate: true };
    case FETCH_STOCKS_REQUEST:
      return { ...state, isFetching: true, didInvalidate: false };
    case FETCH_STOCKS_SUCCESS:
      return {
        ...state,
        isFetching: false,
        didInvalidate: false,
        items: action.data,
        lastUpdated: action.receivedAt,
        error: null,
      };
    case FETCH_STOCKS_ERROR:
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

export default stocks;
