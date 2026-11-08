import { useAppDispatch } from './store';
import type { AppThunk } from './store';
import type { StoredError } from './types/store';

export interface LoadFailure {
  error: StoredError;
  retry: () => void;
}

type Load = readonly [state: { error: StoredError | null }, retry: AppThunk];

// The first failed one of the loads a view depends on, with a retry that
// loads every failed one again. Null while none has failed. A load is null
// while there is nothing to load yet.
const useLoadFailure = (...loads: (Load | null)[]): LoadFailure | null => {
  const dispatch = useAppDispatch();
  const failed = loads.flatMap(load =>
    load === null || load[0].error === null
      ? []
      : [{ error: load[0].error, retry: load[1] }]
  );
  const first = failed[0];
  if (first === undefined) return null;

  return {
    error: first.error,
    retry: () => {
      for (const { retry } of failed) dispatch(retry);
    },
  };
};

export default useLoadFailure;
