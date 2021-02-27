import { map } from 'lodash';

import { invalidateTransactions } from './transactions';

export const UPLOAD_RECEIPTS_REQUEST = 'UPLOAD_RECEIPTS_REQUEST';
export const uploadReceiptsRequest = () => ({
  type: UPLOAD_RECEIPTS_REQUEST,
});

export const UPLOAD_RECEIPTS_SUCCESS = 'UPLOAD_RECEIPTS_SUCCESS';
export const uploadReceiptsSuccess = json => ({
  type: UPLOAD_RECEIPTS_SUCCESS,
  data: json,
  receivedAt: Date.now(),
});

export const UPLOAD_RECEIPTS_ERROR = 'UPLOAD_RECEIPTS_ERROR';
export const uploadReceiptsError = e => ({
  type: UPLOAD_RECEIPTS_ERROR,
  error: e,
  receivedAt: Date.now(),
});

export const uploadReceipts = inputFiles => dispatch => {
  dispatch(uploadReceiptsRequest());

  return Promise.all(
    map(
      inputFiles,
      file =>
        new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onerror = reject;
          fr.onload = () => {
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
      return res.json();
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(uploadReceiptsSuccess(res));
      dispatch(invalidateTransactions());
    })
    .catch(e => dispatch(uploadReceiptsError(e)));
};
