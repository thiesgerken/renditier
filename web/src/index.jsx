import thunkMiddleware from 'redux-thunk';
import { createLogger } from 'redux-logger';
import React from 'react';
import { render } from 'react-dom';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import { createBrowserHistory } from 'history';
import { ConnectedRouter, routerMiddleware } from 'connected-react-router';

import rootReducer from './reducers';
import App from './App';
import './index.css';
import './semantic/dist/semantic.min.css';

const history = createBrowserHistory();

const middlewares = [routerMiddleware(history), thunkMiddleware];
let composeEnhancers = compose;

if (process.env.NODE_ENV === `development`) {
  const loggerMiddleware = createLogger();
  middlewares.push(loggerMiddleware);

  composeEnhancers =
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || composeEnhancers;
}

const store = createStore(
  rootReducer(history),
  composeEnhancers(applyMiddleware(...middlewares))
);

render(
  <Provider store={store}>
    <ConnectedRouter history={history}>
      <App />
    </ConnectedRouter>
  </Provider>,
  document.getElementById('root')
);
