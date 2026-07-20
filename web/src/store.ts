// Store construction lives here so that the app entry point and the tests build
// an identical store instead of duplicating the setup.

import { createLogger } from 'redux-logger';
import { useDispatch, useSelector } from 'react-redux';
import { applyMiddleware, compose, createStore } from 'redux';
import { thunk as thunkMiddleware } from 'redux-thunk';
import type { Middleware, StoreEnhancer } from 'redux';

import rootReducer from './reducers';
import type { AppDispatch } from './types/actions';
import type { RootState } from './types/store';

declare global {
  interface Window {
    __REDUX_DEVTOOLS_EXTENSION_COMPOSE__?: typeof compose;
  }
}

export const createAppStore = () => {
  const middlewares: Middleware[] = [thunkMiddleware];
  let composeEnhancers: (...funcs: StoreEnhancer[]) => StoreEnhancer = compose;

  if (import.meta.env.DEV) {
    middlewares.push(createLogger());

    composeEnhancers =
      window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ ?? composeEnhancers;
  }

  return createStore(
    rootReducer,
    composeEnhancers(applyMiddleware(...middlewares))
  );
};

export type AppStore = ReturnType<typeof createAppStore>;

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
