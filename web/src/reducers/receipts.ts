import {
  UPLOAD_RECEIPTS_REQUEST,
  UPLOAD_RECEIPTS_ERROR,
  UPLOAD_RECEIPTS_SUCCESS,
} from '../actions/receipts';

import type { AppAction } from '../types/actions';
import type { ReceiptsState } from '../types/store';

const receipts = (
  state: ReceiptsState = {
    isUploading: false,
    data: null,
    uploadError: null,
    lastUpload: null,
  },
  action: AppAction
): ReceiptsState => {
  switch (action.type) {
    case UPLOAD_RECEIPTS_REQUEST:
      return { ...state, isUploading: true };
    case UPLOAD_RECEIPTS_SUCCESS:
      return {
        ...state,
        isUploading: false,
        data: action.data,
        lastUpload: action.receivedAt,
        uploadError: null,
      };
    case UPLOAD_RECEIPTS_ERROR:
      return {
        ...state,
        isUploading: false,
        data: null,
        uploadError: action.error,
        lastUpload: action.receivedAt,
      };
    default:
      return state;
  }
};

export default receipts;
