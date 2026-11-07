import { createAsyncThunk } from '@reduxjs/toolkit';

import type { AppDispatch, RootState } from '../store';

// Lives apart from store.ts: the slices call this at module load, and store.ts
// imports the slices, so defining it there would be a runtime import cycle.
export const createAppAsyncThunk = createAsyncThunk.withTypes<{
  state: RootState;
  dispatch: AppDispatch;
}>();
