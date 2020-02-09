import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';

import performance from './performance';
import authentication from './authentication';

const root = history =>
  combineReducers({
    router: connectRouter(history),
    performance,
    authentication,
  });

export default root;
