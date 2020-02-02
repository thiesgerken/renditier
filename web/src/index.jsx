import thunkMiddleware from 'redux-thunk';
import { createLogger } from 'redux-logger';
import React from 'react';
import { render } from 'react-dom';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import App from './App';
import reducer from './reducers';
import './index.css';
import './semantic/dist/semantic.min.css';
import { fetchPerformance } from './actions/performance';
import { login } from './actions/user';

const middlewares = [thunkMiddleware];
let composeEnhancers = compose;

if (process.env.NODE_ENV === `development`) {
  const loggerMiddleware = createLogger();
  middlewares.push(loggerMiddleware);

  composeEnhancers =
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || composeEnhancers;
}

const store = createStore(
  reducer,
  composeEnhancers(applyMiddleware(...middlewares))
);

render(
  <Provider store={store}>
    <App />
  </Provider>,
  document.getElementById('root')
);

store.dispatch(login('thies', 'qwertz123')).then(() => {
  store.dispatch(fetchPerformance());
});
