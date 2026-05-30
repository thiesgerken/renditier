import { thunk as thunkMiddleware } from 'redux-thunk';
import { createLogger } from 'redux-logger';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { createStore, applyMiddleware, compose } from 'redux';
import { Provider } from 'react-redux';
import { Router } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import 'typeface-oxygen';
import { pink, teal } from '@mui/material/colors';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';

import rootReducer from './reducers';
import App from './containers/App';
import ServiceWorker from './containers/ServiceWorker';
import history from './history';

const middlewares = [thunkMiddleware];
let composeEnhancers = compose;

if (import.meta.env.DEV) {
  const loggerMiddleware = createLogger();
  middlewares.push(loggerMiddleware);

  composeEnhancers =
    window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || composeEnhancers;
}

const store = createStore(
  rootReducer,
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

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <Router history={history}>
      <ThemeProvider theme={theme}>
        <LocalizationProvider
          dateAdapter={AdapterMoment}
          dateLibInstance={moment}
        >
          <ServiceWorker />
          <App />
        </LocalizationProvider>
      </ThemeProvider>
    </Router>
  </Provider>
);
