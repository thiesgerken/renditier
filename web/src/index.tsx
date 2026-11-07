import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import GlobalStyles from '@mui/material/GlobalStyles';
import { StyledEngineProvider, ThemeProvider } from '@mui/material/styles';

import './index.css';
import App from './containers/App';
import muiTheme from './muiTheme';
import { TooltipProvider } from './components/ui/tooltip';
import ServiceWorker from './containers/ServiceWorker';
import { createAppStore } from './store';
import { setNavigate } from './navigation';

function NavigationBridge() {
  const navigate = useNavigate();

  React.useEffect(() => setNavigate(navigate), [navigate]);

  return null;
}

const store = createAppStore();

const container = document.getElementById('root');

if (container === null) throw new Error('missing #root container');

createRoot(container).render(
  <Provider store={store}>
    <BrowserRouter>
      <NavigationBridge />
      {/* MUI's styles go into the `mui` layer. Unlayered, they would beat
          every Tailwind utility; in this order, Tailwind's preflight cannot
          reset MUI components, and utilities still win over MUI. The order
          has to be emitted by emotion, which puts its styles ahead of
          index.css, and a layer's position is fixed where it first appears. */}
      <StyledEngineProvider enableCssLayer>
        <GlobalStyles styles="@layer theme, base, mui, components, utilities;" />
        <ThemeProvider theme={muiTheme}>
          <TooltipProvider>
            <ServiceWorker />
            <App />
          </TooltipProvider>
        </ThemeProvider>
      </StyledEngineProvider>
    </BrowserRouter>
  </Provider>
);
