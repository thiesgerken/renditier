import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';

import type { AppStore } from './store';

// Tells React that the tests wrap updates in act().
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// Renders into the document, so that dialogs find their portal target.
export const render = async (ui: ReactNode, store: AppStore) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await act(async () => root.render(<Provider store={store}>{ui}</Provider>));

  return () => {
    act(() => root.unmount());
    container.remove();
  };
};

export const clickButton = async (name: string) => {
  const button = [...document.querySelectorAll('button')].find(
    b => b.textContent?.trim() === name
  );
  if (button === undefined) throw new Error(`no button "${name}"`);
  await act(async () => button.click());
};

export const failingFetch = () =>
  vi.fn(
    async () =>
      new Response(null, { status: 500, statusText: 'Internal Server Error' })
  );
