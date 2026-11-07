import { useLocation, useNavigate } from 'react-router-dom';

// A search parameter as page state, so that the open dialog and the table page
// survive a reload and the back button closes the dialog.
const useQueryParam = (
  key: string
): [string | null, (value: string | number | boolean | null) => void] => {
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);

  const set = (value: string | number | boolean | null) => {
    if (value === null) query.delete(key);
    else query.set(key, `${value}`);

    const qs = query.toString();
    navigate(`${location.pathname}${qs.length ? '?' : ''}${qs}`);
  };

  return [query.get(key), set];
};

export default useQueryParam;
