import { useSyncExternalStore } from 'react';

// Whether a CSS media query matches, for the few things CSS classes cannot
// switch, like a chart's props.
const useMediaQuery = (query: string): boolean =>
  useSyncExternalStore(
    onChange => {
      const list = window.matchMedia(query);
      list.addEventListener('change', onChange);
      return () => list.removeEventListener('change', onChange);
    },
    () => window.matchMedia(query).matches
  );

export default useMediaQuery;

// below Tailwind's sm, i.e. a phone
export const PHONE = '(width < 600px)';

// from Tailwind's md, where the sidebar replaces the tab bar
export const DESKTOP = '(width >= 900px)';
