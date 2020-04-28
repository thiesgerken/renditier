import { combineReducers } from 'redux';
import { connectRouter } from 'connected-react-router';

import accounts from './accounts';
import authentication from './authentication';
import notifications from './notifications';
import portfolioPlot from './portfolioPlot';
import transactions from './transactions';
import receipts from './receipts';
import stockPlot from './stockPlot';

import {
  resourceReducer,
  stockResource,
  performanceResource,
} from '../apiResources';

const root = history =>
  combineReducers({
    router: connectRouter(history),
    authentication,
    notifications,
    portfolioPlot,
    stockPlot,
    accounts,
    transactions,
    receipts,
    performance: resourceReducer(performanceResource),
    stocks: resourceReducer(stockResource),
  });

export default root;
