import React from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { BrowserRouter, useNavigate } from 'react-router-dom';

import './index.css';
import './i18n';
import App from './containers/App';
import { TooltipProvider } from './components/ui/tooltip';
import ScrollRestoration from './ScrollRestoration';
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
      <ScrollRestoration />
      <TooltipProvider>
        <ServiceWorker />
        <App />
      </TooltipProvider>
    </BrowserRouter>
  </Provider>
);
