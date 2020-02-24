import thunkMiddleware from 'redux-thunk';
import { createLogger } from 'redux-logger';
import React from 'react';
import { render } from 'react-dom';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import { createBrowserHistory } from 'history';
import { ConnectedRouter, routerMiddleware } from 'connected-react-router';
import { ThemeProvider, createMuiTheme } from '@material-ui/core';
import 'typeface-oxygen';
import teal from '@material-ui/core/colors/teal';
import lightGreen from '@material-ui/core/colors/lightGreen';

import rootReducer from './reducers';
import App from './containers/App';
import * as serviceWorker from './serviceWorker';

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

const theme = createMuiTheme({
  typography: {
    fontFamily: ['Oxygen'].join(','),
  },
  palette: {
    primary: teal,
    secondary: lightGreen,
  },
});

render(
  <Provider store={store}>
    <ConnectedRouter history={history}>
      <ThemeProvider theme={theme}>
        <App />
      </ThemeProvider>
    </ConnectedRouter>
  </Provider>,
  document.getElementById('root')
);

serviceWorker.register({
  onInit: registration => {
    console.log('onInit called');
    console.log(registration);

    // TODO: dispatch action that updates the state with the registration.
    // TODO: check for push registration and tell the server as soon as we are logged in
    // TODO: settings panel with a checkbox for push messages (if state contains a registration)
  },
});
