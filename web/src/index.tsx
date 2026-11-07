import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import 'typeface-oxygen';
import { pink, teal } from '@mui/material/colors';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';
import 'moment/dist/locale/de';

import App from './containers/App';
import ServiceWorker from './containers/ServiceWorker';
import { createAppStore } from './store';
import { setNavigate } from './navigation';

function NavigationBridge() {
  const navigate = useNavigate();

  React.useEffect(() => setNavigate(navigate), [navigate]);

  return null;
}

moment.locale('de');

const store = createAppStore();

const theme = createTheme({
  typography: {
    fontFamily: ['Oxygen'].join(','),
  },
  palette: {
    primary: teal,
    secondary: pink,
  },
  components: {
    MuiTableCell: {
      styleOverrides: {
        // right-aligned cells hold numbers, whose digits should line up
        alignRight: { fontVariantNumeric: 'tabular-nums' },
      },
    },
  },
});

const container = document.getElementById('root');

if (container === null) throw new Error('missing #root container');

createRoot(container).render(
  <Provider store={store}>
    <BrowserRouter>
      <NavigationBridge />
      <ThemeProvider theme={theme}>
        <LocalizationProvider
          dateAdapter={AdapterMoment}
          dateLibInstance={moment}
          adapterLocale="de"
        >
          <ServiceWorker />
          <App />
        </LocalizationProvider>
      </ThemeProvider>
    </BrowserRouter>
  </Provider>
);
