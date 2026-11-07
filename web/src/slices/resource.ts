import { createSlice } from '@reduxjs/toolkit';
import type {
  ActionCreatorWithoutPayload,
  AsyncThunk,
  Reducer,
} from '@reduxjs/toolkit';

import { fetchJson } from '../api';
import type { AppDispatch, RootState } from '../store';
import type { ResourceState } from '../types/store';
import { createAppAsyncThunk } from './createAppAsyncThunk';
import { isOutdated } from './freshness';

interface Resource<T> {
  reducer: Reducer<ResourceState<T>>;
  fetch: AsyncThunk<T, void, { state: RootState; dispatch: AppDispatch }>;
  invalidate: ActionCreatorWithoutPayload;
}

// A read-only API list that starts out invalidated and is fetched again once it
// is outdated, invalidated by a change elsewhere, or after a failed load.
//
// RootState is inferred from the reducers this returns, so the signature must
// not depend on it: the return type is spelled out, and the slice is found by
// its name instead of a selector argument.
export const createResourceSlice = <T>(
  name: 'stocks' | 'performance',
  url: string
): Resource<T> => {
  const initialState: ResourceState<T> = {
    isFetching: false,
    didInvalidate: true,
    data: null,
    error: null,
    lastRequest: null,
  };

  const fetchResource = createAppAsyncThunk(
    `${name}/fetch`,
    () => fetchJson<T>(url),
    {
      condition: (_, { getState }) => {
        const resource = getState()[name];
        return (
          !resource.isFetching &&
          ((resource.lastRequest === null && resource.error === null) ||
            resource.didInvalidate ||
            isOutdated(resource.lastRequest))
        );
      },
    }
  );

  const slice = createSlice({
    name,
    initialState,
    reducers: {
      invalidate: state => {
        state.didInvalidate = true;
      },
    },
    extraReducers: builder => {
      builder
        .addCase(fetchResource.pending, state => {
          state.isFetching = true;
        })
        .addCase(fetchResource.fulfilled, (_, action) => ({
          isFetching: false,
          didInvalidate: false,
          data: action.payload,
          error: null,
          lastRequest: Date.now(),
        }))
        .addCase(fetchResource.rejected, (state, action) => {
          state.isFetching = false;
          state.didInvalidate = true;
          state.error = action.error;
          state.lastRequest = Date.now();
        });
    },
  });

  return {
    reducer: slice.reducer,
    fetch: fetchResource,
    invalidate: slice.actions.invalidate,
  };
};
