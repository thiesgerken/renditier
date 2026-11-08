import { createSlice } from '@reduxjs/toolkit';
import { map } from 'lodash';

import { fetchJson } from '../api';
import type { FileContents, ReceiptImport } from '../types/api';
import type { ReceiptsState } from '../types/store';
import { createAppAsyncThunk } from './createAppAsyncThunk';
import { invalidateTransactions } from './transactions';

const initialState: ReceiptsState = {
  isUploading: false,
  data: null,
  uploadError: null,
  lastUpload: null,
};

const readFile = (file: File) =>
  new Promise<FileContents>((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      // readAsDataURL always resolves to a string; the check is only what
      // narrows `string | ArrayBuffer | null`.
      if (typeof fr.result !== 'string') {
        reject(Error('FileReader did not produce a string'));
        return;
      }
      // "data:application/pdf;base64,<bytes>"
      const bytes = fr.result.slice(fr.result.indexOf(',') + 1);
      resolve({ name: file.name, bytes });
    };
    fr.readAsDataURL(file);
  });

export const uploadReceipts = createAppAsyncThunk(
  'receipts/upload',
  async (inputFiles: FileList | File[], { dispatch }) => {
    const files = await Promise.all(map(inputFiles, readFile));
    const response = await fetchJson<ReceiptImport>('/api/receipts', {
      method: 'POST',
      body: JSON.stringify(files),
    });

    dispatch(invalidateTransactions());
    return response;
  }
);

const receipts = createSlice({
  name: 'receipts',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(uploadReceipts.pending, state => {
        state.isUploading = true;
      })
      .addCase(uploadReceipts.fulfilled, (state, action) => {
        state.isUploading = false;
        state.data = action.payload;
        state.lastUpload = Date.now();
        state.uploadError = null;
      })
      .addCase(uploadReceipts.rejected, (state, action) => {
        state.isUploading = false;
        state.data = null;
        state.uploadError = action.error;
        state.lastUpload = Date.now();
      });
  },
});

export default receipts.reducer;
