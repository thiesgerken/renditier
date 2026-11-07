import { act } from 'react';
import type { ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';

import type { AppStore } from './store';

// Tells React that the tests wrap updates in act().
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

// act() with an async callback also flushes what `work` sets off, e.g. a
// thunk's fetch and the state updates after it; a sync one would not.
// eslint-disable-next-line @typescript-eslint/require-await
const settle = (work: () => void) => act(async () => work());

// Renders into the document, so that dialogs find their portal target.
export const render = async (ui: ReactNode, store: AppStore) => {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  await settle(() => {
    root.render(<Provider store={store}>{ui}</Provider>);
  });

  return () => {
    act(() => root.unmount());
    container.remove();
  };
};

export const clickButton = async (name: string) => {
  const button = [...document.querySelectorAll('button')].find(
    b => b.textContent.trim() === name
  );
  if (button === undefined) throw new Error(`no button "${name}"`);
  await settle(() => {
    button.click();
  });
};

export const failingFetch = () =>
  vi.fn(() =>
    Promise.resolve(
      new Response(null, { status: 500, statusText: 'Internal Server Error' })
    )
  );
