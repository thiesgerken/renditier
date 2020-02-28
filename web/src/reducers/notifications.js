import { UPDATE_REGISTRATION } from '../actions/notifications';

const notifications = (
  state = {
    registration: null,
  },
  action
) => {
  switch (action.type) {
    case UPDATE_REGISTRATION:
      return {
        ...state,
        registration: action.registration,
      };
    default:
      return state;
  }
};

export default notifications;
