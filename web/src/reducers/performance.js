import {
  INVALIDATE_PERFORMANCE,
  FETCH_PERFORMANCE_REQUEST,
  FETCH_PERFORMANCE_ERROR,
  FETCH_PERFORMANCE_SUCCESS,
} from '../actions/performance';

const performance = (
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
    case INVALIDATE_PERFORMANCE:
      return { ...state, didInvalidate: true };
    case FETCH_PERFORMANCE_REQUEST:
      return { ...state, isFetching: true, didInvalidate: false };
    case FETCH_PERFORMANCE_SUCCESS:
      return {
        ...state,
        isFetching: false,
        didInvalidate: false,
        items: action.data,
        lastUpdated: action.receivedAt,
        error: null,
      };
    case FETCH_PERFORMANCE_ERROR:
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

export default performance;
