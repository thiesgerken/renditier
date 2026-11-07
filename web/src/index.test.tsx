import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterMoment } from '@mui/x-date-pickers/AdapterMoment';
import moment from 'moment';
import 'moment/dist/locale/de';

import App from './containers/App';
import ServiceWorker from './containers/ServiceWorker';
import { createAppStore } from './store';
import muiTheme from './muiTheme';
import { TooltipProvider } from './components/ui/tooltip';

it('renders without crashing', () => {
  moment.locale('de');
  const store = createAppStore();

  const div = document.createElement('div');

  const root = createRoot(div);

  root.render(
    <Provider store={store}>
      <MemoryRouter>
        <ThemeProvider theme={muiTheme}>
          <LocalizationProvider
            dateAdapter={AdapterMoment}
            dateLibInstance={moment}
            adapterLocale="de"
          >
            <TooltipProvider>
              <ServiceWorker />
              <App />
            </TooltipProvider>
          </LocalizationProvider>
        </ThemeProvider>
      </MemoryRouter>
    </Provider>
  );

  root.unmount();
});
