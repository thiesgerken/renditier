import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';

import performance from './performance';
import authentication from './authentication';
import notifications from './notifications';

const root = history =>
  combineReducers({
    router: connectRouter(history),
    performance,
    authentication,
    notifications,
  });

export default root;
