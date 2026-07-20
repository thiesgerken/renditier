import { map } from 'lodash';

import { invalidateTransactions } from './transactions';

import type { AppThunk } from '../types/actions';
import type { FileContents, Transaction } from '../types/api';
import type { StoredError, Timestamp } from '../types/store';

export const UPLOAD_RECEIPTS_REQUEST = 'UPLOAD_RECEIPTS_REQUEST';
export interface UploadReceiptsRequestAction {
  type: typeof UPLOAD_RECEIPTS_REQUEST;
}
export const uploadReceiptsRequest = (): UploadReceiptsRequestAction => ({
  type: UPLOAD_RECEIPTS_REQUEST,
});

export const UPLOAD_RECEIPTS_SUCCESS = 'UPLOAD_RECEIPTS_SUCCESS';
export interface UploadReceiptsSuccessAction {
  type: typeof UPLOAD_RECEIPTS_SUCCESS;
  data: Transaction[];
  receivedAt: Timestamp;
}
export const uploadReceiptsSuccess = (
  json: Transaction[]
): UploadReceiptsSuccessAction => ({
  type: UPLOAD_RECEIPTS_SUCCESS,
  data: json,
  receivedAt: Date.now(),
});

export const UPLOAD_RECEIPTS_ERROR = 'UPLOAD_RECEIPTS_ERROR';
export interface UploadReceiptsErrorAction {
  type: typeof UPLOAD_RECEIPTS_ERROR;
  error: StoredError;
  receivedAt: Timestamp;
}
export const uploadReceiptsError = (
  e: StoredError
): UploadReceiptsErrorAction => ({
  type: UPLOAD_RECEIPTS_ERROR,
  error: e,
  receivedAt: Date.now(),
});

export type ReceiptsAction =
  | UploadReceiptsRequestAction
  | UploadReceiptsSuccessAction
  | UploadReceiptsErrorAction;

export const uploadReceipts =
  (
    inputFiles: FileList | File[]
  ): AppThunk<Promise<void | UploadReceiptsErrorAction>> =>
  dispatch => {
    dispatch(uploadReceiptsRequest());

    return Promise.all(
      map(
        inputFiles,
        file =>
          new Promise<FileContents>((resolve, reject) => {
            const fr = new FileReader();
            fr.onerror = reject;
            fr.onload = () => {
              // readAsBinaryString always resolves to a string; the check is
              // only what narrows `string | ArrayBuffer | null` for btoa.
              if (typeof fr.result !== 'string') {
                reject(Error('FileReader did not produce a string'));
                return;
              }
              resolve({ name: file.name, bytes: window.btoa(fr.result) });
            };
            fr.readAsBinaryString(file);
          })
      )
    )
      .then(urls =>
        fetch(`/api/receipts`, {
          method: 'POST',
          body: JSON.stringify(urls),
        })
      )
      .then(res => {
        if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<Transaction[] & { error?: StoredError }>;
      })
      .then(res => {
        if (res.error) throw res.error;

        dispatch(uploadReceiptsSuccess(res));
        dispatch(invalidateTransactions());
      })
      .catch((e: StoredError) => dispatch(uploadReceiptsError(e)));
  };
