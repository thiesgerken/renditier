import React from 'react';
import { thunk as thunkMiddleware } from 'redux-thunk';
import { createLogger } from 'redux-logger';
import { createRoot } from 'react-dom/client';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import { createBrowserHistory } from 'history';
import { ConnectedRouter, routerMiddleware } from 'connected-react-router';
import { ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import 'typeface-oxygen';
import { pink, teal } from '@mui/material/colors';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import * as moment from 'moment';

import rootReducer from './reducers';
import App from './containers/App';
import ServiceWorker from './containers/ServiceWorker';

it('renders without crashing', () => {
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

  const theme = createTheme({
    typography: {
      fontFamily: ['Oxygen'].join(','),
    },
    palette: {
      primary: teal,
      secondary: pink,
    },
  });

  const div = document.createElement('div');

  const root = createRoot(div);

  root.render(
    <Provider store={store}>
      <ConnectedRouter history={history}>
        <ThemeProvider theme={theme}>
          <LocalizationProvider
            dateAdapter={AdapterMoment}
            dateLibInstance={moment}
          >
            <ServiceWorker />
            <App />
          </LocalizationProvider>
        </ThemeProvider>
      </ConnectedRouter>
    </Provider>
  );

  root.unmount();
});
