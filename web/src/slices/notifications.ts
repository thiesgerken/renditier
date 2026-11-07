import { createSlice } from '@reduxjs/toolkit';

import type { NotificationsState } from '../types/store';

const initialState: NotificationsState = {
  updateAvailable: false,
  updateIgnored: false,
};

const notifications = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    updateAvailable: state => {
      state.updateAvailable = true;
    },
    ignoreUpdate: state => {
      state.updateIgnored = true;
    },
  },
});

export default notifications.reducer;
export const { updateAvailable, ignoreUpdate } = notifications.actions;
