import type { NavigateFunction } from 'react-router-dom';

let navigate: NavigateFunction | null = null;

export const setNavigate = (nextNavigate: NavigateFunction): (() => void) => {
  navigate = nextNavigate;

  return () => {
    if (navigate === nextNavigate) navigate = null;
  };
};

export const navigateTo = (path: string): void => {
  if (navigate) {
    void navigate(path);
    return;
  }

  window.location.assign(path);
};
