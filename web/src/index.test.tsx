import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';

import App from './containers/App';
import ServiceWorker from './containers/ServiceWorker';
import { createAppStore } from './store';
import { TooltipProvider } from './components/ui/tooltip';

it('renders without crashing', () => {
  const store = createAppStore();

  const div = document.createElement('div');

  const root = createRoot(div);

  root.render(
    <Provider store={store}>
      <MemoryRouter>
        <TooltipProvider>
          <ServiceWorker />
          <App />
        </TooltipProvider>
      </MemoryRouter>
    </Provider>
  );

  root.unmount();
});
