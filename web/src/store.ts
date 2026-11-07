// Store construction lives here so that the app entry point and the tests build
// an identical store instead of duplicating the setup.

import { combineReducers, configureStore } from '@reduxjs/toolkit';
import type { ThunkAction, UnknownAction } from '@reduxjs/toolkit';
import { useDispatch, useSelector } from 'react-redux';

import accounts from './slices/accounts';
import authentication from './slices/authentication';
import notifications from './slices/notifications';
import performance from './slices/performance';
import portfolioPlot from './slices/portfolioPlot';
import receipts from './slices/receipts';
import stockPlot from './slices/stockPlot';
import stocks from './slices/stocks';
import transactions from './slices/transactions';

const rootReducer = combineReducers({
  authentication,
  notifications,
  portfolioPlot,
  stockPlot,
  accounts,
  transactions,
  receipts,
  performance,
  stocks,
});

export const createAppStore = () =>
  configureStore({
    reducer: rootReducer,
    devTools: import.meta.env.DEV,
  });

export type RootState = ReturnType<typeof rootReducer>;
export type AppStore = ReturnType<typeof createAppStore>;
export type AppDispatch = AppStore['dispatch'];
export type AppThunk<R = void> = ThunkAction<
  R,
  RootState,
  undefined,
  UnknownAction
>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
