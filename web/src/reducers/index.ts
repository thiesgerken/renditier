import { combineReducers } from 'redux';

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

import type { AppAction } from '../types/actions';
import type { RootState } from '../types/store';

// Annotated rather than inferred, so that any drift between the slices combined
// here and `RootState` in ../types/store is a compile error. `RootState` sits in
// both an argument and the return type, so drift in either direction is caught.
//
// Spelled out as a function type rather than as redux's `Reducer<RootState,
// AppAction>`: comparing two `Reducer<...>` references also compares their
// `PreloadedState` arguments, and `combineReducers` infers a degenerate one here
// (every slice reducer declares `action: AppAction` rather than redux's
// `UnknownAction`, which is what that inference looks for).
const root: (state: RootState | undefined, action: AppAction) => RootState =
  combineReducers({
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
