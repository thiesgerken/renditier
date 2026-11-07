import { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, useNavigate } from 'react-router-dom';
import type { NavigateFunction } from 'react-router-dom';

import ScrollRestoration from './ScrollRestoration';

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

const router: { navigate?: NavigateFunction } = {};
const Navigator = () => {
  const navigate = useNavigate();
  useEffect(() => {
    router.navigate = navigate;
  }, [navigate]);
  return null;
};

// jsdom does not scroll: scrollTo records, scrolling the user is simulated.
const scrollTo = vi.fn();
const scrollBy = (y: number) => {
  Object.defineProperty(window, 'scrollY', { value: y, configurable: true });
  window.dispatchEvent(new Event('scroll'));
};
const go = (to: string | number, options?: { replace: boolean }) =>
  act(() => {
    const { navigate } = router;
    if (navigate === undefined) throw new Error('not rendered');
    void (typeof to === 'number' ? navigate(to) : navigate(to, options));
  });

describe('ScrollRestoration', () => {
  beforeEach(() => {
    vi.stubGlobal('scrollTo', scrollTo);
    const root = createRoot(document.createElement('div'));
    act(() => {
      root.render(
        <MemoryRouter initialEntries={['/stocks']}>
          <Navigator />
          <ScrollRestoration />
        </MemoryRouter>
      );
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    scrollTo.mockClear();
  });

  it('starts a new page at the top and keeps it for query changes', () => {
    scrollBy(400);
    go('/stocks?all=1', { replace: true });
    go('/stocks?page=2');
    expect(scrollTo).not.toHaveBeenCalled();

    go('/transactions');
    expect(scrollTo).toHaveBeenCalledExactlyOnceWith(0, 0);
  });

  it('returns to where a page was left on back and forward', () => {
    scrollBy(400);
    go('/dashboard?tab=positions');
    scrollBy(900);
    go('/dashboard?tab=periods', { replace: true });
    scrollBy(1200);

    go(-1);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 400);

    go(1);
    expect(scrollTo).toHaveBeenLastCalledWith(0, 1200);
  });
});
