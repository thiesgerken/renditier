import {
  createSlice,
  isAnyOf,
  isFulfilled,
  isRejected,
} from '@reduxjs/toolkit';
import type {
  ActionCreatorWithoutPayload,
  AsyncThunk,
  Reducer,
} from '@reduxjs/toolkit';

import { fetchJson } from '../api';
import type { AppDispatch, RootState } from '../store';
import type { ResourceState } from '../types/store';
import { createAppAsyncThunk } from './createAppAsyncThunk';
import { needsFetch } from './freshness';

type ThunkApi = { state: RootState; dispatch: AppDispatch };

// The thunks' argument and result types differ, and AsyncThunk is invariant in
// them.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Change = AsyncThunk<any, any, ThunkApi>;

export interface Resource<T> {
  reducer: Reducer<ResourceState<T>>;
  fetch: AsyncThunk<T, void, ThunkApi>;
  invalidate: ActionCreatorWithoutPayload;
}

// An API list, fetched again once it is outdated or invalidated by a change
// elsewhere. `changes` are the thunks that modify the list itself: once one
// settles, the list is outdated. Their failures are for the caller to show
// (see useChange); `error` is only about loading the list.
//
// RootState is inferred from the reducers this returns, so the signature must
// not depend on it: the return type is spelled out, and the slice is found by
// its name instead of a selector argument.
export const createResourceSlice = <T>(
  name:
    | 'stocks'
    | 'stockReturns'
    | 'performance'
    | 'accounts'
    | 'transactions'
    | 'apiKeys',
  url: string,
  changes?: [Change, ...Change[]]
): Resource<T> => {
  const initialState: ResourceState<T> = {
    isFetching: false,
    didInvalidate: false,
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
        return needsFetch({ ...resource, lastUpdated: resource.lastRequest });
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
          state.didInvalidate = false;
          state.error = action.error;
          state.lastRequest = Date.now();
        });

      if (changes !== undefined) {
        builder.addMatcher(
          isAnyOf(isFulfilled(...changes), isRejected(...changes)),
          state => {
            state.didInvalidate = true;
          }
        );
      }
    },
  });

  return {
    reducer: slice.reducer,
    fetch: fetchResource,
    invalidate: slice.actions.invalidate,
  };
};
