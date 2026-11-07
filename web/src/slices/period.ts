import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

import type { PeriodState } from '../types/store';

const initialState: PeriodState = {
  selected: 'Total',
};

const period = createSlice({
  name: 'period',
  initialState,
  reducers: {
    selectPeriod: (state, action: PayloadAction<string>) => {
      state.selected = action.payload;
    },
  },
});

export default period.reducer;
export const { selectPeriod } = period.actions;
