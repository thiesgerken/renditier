import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';

import performance from './performance';
import stocks from './stocks';
import authentication from './authentication';
import notifications from './notifications';
import portfolioPlot from './portfolioPlot';
import stockPlot from './stockPlot';

const root = history =>
  combineReducers({
    router: connectRouter(history),
    performance,
    authentication,
    notifications,
    portfolioPlot,
    stockPlot,
    stocks,
  });

export default root;
