// The single action union the store dispatches. Every reducer must accept
// `AppAction` (not just its own slice's actions) — `combineReducers` checks the
// action parameter contravariantly, so a reducer narrowed to one slice would not
// be assignable.
//
// Each actions module owns its own union and re-exports it here.

import type { ThunkAction, ThunkDispatch } from 'redux-thunk';

import type { ResourceAction } from '../apiResources';
import type { AccountsAction } from '../actions/accounts';
import type { AuthenticationAction } from '../actions/authentication';
import type { NotificationsAction } from '../actions/notifications';
import type { PortfolioPlotAction } from '../actions/portfolioPlot';
import type { ReceiptsAction } from '../actions/receipts';
import type { StockPlotAction } from '../actions/stockPlot';
import type { TransactionsAction } from '../actions/transactions';
import type { RootState } from './store';

export type AppAction =
  | AccountsAction
  | AuthenticationAction
  | NotificationsAction
  | PortfolioPlotAction
  | ReceiptsAction
  | ResourceAction
  | StockPlotAction
  | TransactionsAction;

// Thunks return a promise almost everywhere; the ones that short-circuit return
// Promise.resolve(), so `Promise<void>` is the common case.
export type AppThunk<R = Promise<void>> = ThunkAction<
  R,
  RootState,
  unknown,
  AppAction
>;

export type AppDispatch = ThunkDispatch<RootState, unknown, AppAction>;
