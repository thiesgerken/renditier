import { useEffect, useLayoutEffect, useRef } from 'react';
import {
  NavigationType,
  useLocation,
  useNavigationType,
} from 'react-router-dom';

// The window's position per history entry, for back and forward. Lost on a
// reload, which then starts at the top.
const positions = new Map<string, number>();

// react-router's <ScrollRestoration> needs a data router; the app uses
// <BrowserRouter>. A new page starts at the top, back and forward return to
// where the page was left. Changes of the query alone (a tab, a page of a
// table, a dialog) keep the position: they are the same page.
const ScrollRestoration = () => {
  const { pathname, key } = useLocation();
  const navigationType = useNavigationType();
  const shown = useRef({ pathname, key });

  useEffect(() => {
    const remember = () => positions.set(shown.current.key, window.scrollY);
    window.addEventListener('scroll', remember, { passive: true });
    return () => {
      window.removeEventListener('scroll', remember);
    };
  }, []);

  // Before paint, so that the new page never shows at the old position.
  useLayoutEffect(() => {
    const samePage = pathname === shown.current.pathname;
    // From here on, scrolling belongs to the new entry, the jump below too:
    // the old entry keeps the position it was left at.
    shown.current = { pathname, key };
    if (samePage) return;

    window.scrollTo(
      0,
      navigationType === NavigationType.Pop ? (positions.get(key) ?? 0) : 0
    );
  }, [pathname, key, navigationType]);

  return null;
};

export default ScrollRestoration;
