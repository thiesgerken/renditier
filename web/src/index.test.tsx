import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';

import App from './containers/App';
import ServiceWorker from './containers/ServiceWorker';
import { createAppStore } from './store';
import muiTheme from './muiTheme';
import { TooltipProvider } from './components/ui/tooltip';

it('renders without crashing', () => {
  const store = createAppStore();

  const div = document.createElement('div');

  const root = createRoot(div);

  root.render(
    <Provider store={store}>
      <MemoryRouter>
        <ThemeProvider theme={muiTheme}>
          <TooltipProvider>
            <ServiceWorker />
            <App />
          </TooltipProvider>
        </ThemeProvider>
      </MemoryRouter>
    </Provider>
  );

  root.unmount();
});
