let navigate = null;

export const setNavigate = nextNavigate => {
  navigate = nextNavigate;

  return () => {
    if (navigate === nextNavigate) navigate = null;
  };
};

export const navigateTo = path => {
  if (navigate) {
    navigate(path);
    return;
  }

  window.location.assign(path);
};
