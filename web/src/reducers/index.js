import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';

import performance from './performance';
import authentication from './authentication';
import notifications from './notifications';
import portfolioPlot from './portfolio-plot';

const root = history =>
  combineReducers({
    router: connectRouter(history),
    performance,
    authentication,
    notifications,
    portfolioPlot,
  });

export default root;
