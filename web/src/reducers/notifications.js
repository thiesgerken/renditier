import {
  UPDATE_REGISTRATION,
  SUBSCRIBE_REQUEST,
  SUBSCRIBE_SUCCESS,
  SUBSCRIBE_ERROR,
  UNSUBSCRIBE_REQUEST,
  UNSUBSCRIBE_SUCCESS,
  UNSUBSCRIBE_ERROR,
} from '../actions/notifications';

const notifications = (
  state = {
    registration: null,
    subscribing: false,
    subscribeError: null,
    subscription: null,
    unsubscribing: false,
    unsubscribeError: null,
  },
  action
) => {
  switch (action.type) {
    case UPDATE_REGISTRATION:
      return {
        ...state,
        registration: action.registration,
      };
    case SUBSCRIBE_REQUEST:
      return {
        ...state,
        subscribing: true,
      };
    case SUBSCRIBE_SUCCESS:
      return {
        ...state,
        subscribing: false,
        subscribeError: null,
        subscription: action.subscription,
      };
    case SUBSCRIBE_ERROR:
      return {
        ...state,
        subscribing: false,
        subscribeError: action.error,
      };
    case UNSUBSCRIBE_REQUEST:
      return {
        ...state,
        unsubscribing: true,
      };
    case UNSUBSCRIBE_SUCCESS:
      return {
        ...state,
        unsubscribing: false,
        unsubscribeError: null,
        subscription: null,
      };
    case UNSUBSCRIBE_ERROR:
      return {
        ...state,
        unsubscribing: false,
        unsubscribeError: action.error,
      };
    default:
      return state;
  }
};

export default notifications;
