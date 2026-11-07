import { createAsyncThunk } from '@reduxjs/toolkit';

import type { AppDispatch, RootState } from '../store';

// A dispatched thunk's promise resolves even when the thunk fails (to the
// rejected action), so callers that don't need the result discard it with
// `void`.
//
// Lives apart from store.ts: the slices call this at module load, and store.ts
// imports the slices, so defining it there would be a runtime import cycle.
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
}>();
