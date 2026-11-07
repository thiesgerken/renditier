import { UPDATE_AVAILABLE, IGNORE_UPDATE } from '../actions/notifications';

import type { AppAction } from '../types/actions';
import type { NotificationsState } from '../types/store';

const initialState: NotificationsState = {
  updateAvailable: false,
  updateIgnored: false,
};

const notifications = (
  state: NotificationsState = initialState,
  action: AppAction
): NotificationsState => {
  switch (action.type) {
    case UPDATE_AVAILABLE:
      return {
        ...state,
        updateAvailable: true,
      };
    case IGNORE_UPDATE:
      return {
        ...state,
        updateIgnored: true,
      };
    default:
      return state;
  }
};

export default notifications;
