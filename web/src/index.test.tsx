import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { createTheme } from '@mui/material/styles';
import '@fontsource/oxygen/400.css';
import '@fontsource/oxygen/700.css';
import { pink, teal } from '@mui/material/colors';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';
import 'moment/dist/locale/de';

import App from './containers/App';
import ServiceWorker from './containers/ServiceWorker';
import { createAppStore } from './store';

it('renders without crashing', () => {
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
  });

  const div = document.createElement('div');

  const root = createRoot(div);

  root.render(
    <Provider store={store}>
      <MemoryRouter>
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
      </MemoryRouter>
    </Provider>
  );

  root.unmount();
});
