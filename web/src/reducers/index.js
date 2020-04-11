import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';

import performance from './performance';
import stocks from './stocks';
import accounts from './accounts';
import authentication from './authentication';
import notifications from './notifications';
import portfolioPlot from './portfolioPlot';
import transactions from './transactions';
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
    accounts,
    transactions,
  });

export default root;
