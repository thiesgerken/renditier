import { isAuthenticated } from '../selectors/authentication';

import type { AppThunk } from '../types/actions';
import type { StoredError, Timestamp } from '../types/store';

// Both push chains test `res.error` on the unparsed Response rather than on a
// parsed body; a Response never carries that key, so the check never fires.
// Typed so the existing checks can be kept verbatim.
type ResponseWithError = Response & { error?: StoredError };

export const UPDATE_REGISTRATION = 'UPDATE_REGISTRATION';
export interface UpdateRegistrationAction {
  type: typeof UPDATE_REGISTRATION;
  registration: ServiceWorkerRegistration;
}
export const updateRegistration = (
  registration: ServiceWorkerRegistration
): UpdateRegistrationAction => ({
  type: UPDATE_REGISTRATION,
  registration,
});

export const UPDATE_AVAILABLE = 'UPDATE_AVAILABLE';
export interface UpdateAvailableAction {
  type: typeof UPDATE_AVAILABLE;
}
export const updateAvailable = (): UpdateAvailableAction => ({
  type: UPDATE_AVAILABLE,
});

export const IGNORE_UPDATE = 'IGNORE_UPDATE';
export interface IgnoreUpdateAction {
  type: typeof IGNORE_UPDATE;
}
export const ignoreUpdate = (): IgnoreUpdateAction => ({
  type: IGNORE_UPDATE,
});

export const SUBSCRIBE_REQUEST = 'SUBSCRIBE_REQUEST';
export interface SubscribeRequestAction {
  type: typeof SUBSCRIBE_REQUEST;
}
export const subscribeRequest = (): SubscribeRequestAction => ({
  type: SUBSCRIBE_REQUEST,
});

export const SUBSCRIBE_SUCCESS = 'SUBSCRIBE_SUCCESS';
export interface SubscribeSuccessAction {
  type: typeof SUBSCRIBE_SUCCESS;
  date: Timestamp;
  subscription: PushSubscription;
}
export const subscribeSuccess = (
  subscription: PushSubscription
): SubscribeSuccessAction => ({
  type: SUBSCRIBE_SUCCESS,
  date: Date.now(),
  subscription,
});

export const SUBSCRIBE_ERROR = 'SUBSCRIBE_ERROR';
export interface SubscribeErrorAction {
  type: typeof SUBSCRIBE_ERROR;
  error: StoredError;
  date: Timestamp;
}
export const subscribeError = (e: StoredError): SubscribeErrorAction => ({
  type: SUBSCRIBE_ERROR,
  error: e,
  date: Date.now(),
});

export const UNSUBSCRIBE_REQUEST = 'UNSUBSCRIBE_REQUEST';
export interface UnsubscribeRequestAction {
  type: typeof UNSUBSCRIBE_REQUEST;
}
export const unsubscribeRequest = (): UnsubscribeRequestAction => ({
  type: UNSUBSCRIBE_REQUEST,
});

export const UNSUBSCRIBE_SUCCESS = 'UNSUBSCRIBE_SUCCESS';
export interface UnsubscribeSuccessAction {
  type: typeof UNSUBSCRIBE_SUCCESS;
  date: Timestamp;
}
export const unsubscribeSuccess = (): UnsubscribeSuccessAction => ({
  type: UNSUBSCRIBE_SUCCESS,
  date: Date.now(),
});

export const UNSUBSCRIBE_ERROR = 'UNSUBSCRIBE_ERROR';
export interface UnsubscribeErrorAction {
  type: typeof UNSUBSCRIBE_ERROR;
  error: StoredError;
  date: Timestamp;
}
export const unsubscribeError = (e: StoredError): UnsubscribeErrorAction => ({
  type: UNSUBSCRIBE_ERROR,
  error: e,
  date: Date.now(),
});

// The rejections these chains catch are either DOMExceptions from the Push API,
// fetch network failures, or the `{ message }` literals thrown above — all
// StoredError.
export const subscribe =
  (): AppThunk<Promise<void | SubscribeErrorAction>> =>
  (dispatch, getState) => {
    const state = getState();

    if (!isAuthenticated(state)) {
      dispatch(
        subscribeError({ message: 'cannot subscribe to push: not logged in' })
      );
      return Promise.resolve();
    }

    const { notifications, authentication } = state;
    const { userInfo } = authentication;

    // FIXME(tsx-migration): isAuthenticated() above already guarantees userInfo
    // is non-null, but applicationServerKey is `string | null` and the original
    // only rejected '', so a null key reached urlBase64ToUint8Array and threw a
    // TypeError outside any catch.
    if (userInfo === null || !userInfo.applicationServerKey) {
      dispatch(
        subscribeError({ message: 'cannot subscribe to push: no server key' })
      );
      return Promise.resolve();
    }

    dispatch(subscribeRequest());

    if (notifications.registration === null) {
      dispatch(
        subscribeError({
          message: 'cannot subscribe to push: service worker not registered',
        })
      );
      return Promise.resolve();
    }

    // Uint8Array<ArrayBuffer>, not the default Uint8Array<ArrayBufferLike>:
    // pushManager.subscribe() takes a BufferSource, which excludes views over a
    // SharedArrayBuffer.
    const urlBase64ToUint8Array = (
      base64String: string
    ): Uint8Array<ArrayBuffer> => {
      const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
      const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

      const rawData = window.atob(base64);
      const outputArray = new Uint8Array(rawData.length);

      for (let i = 0; i < rawData.length; i += 1) {
        outputArray[i] = rawData.charCodeAt(i);
      }
      return outputArray;
    };

    return notifications.registration.pushManager
      .subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          userInfo.applicationServerKey
        ),
      })
      .then(subscription => {
        fetch(encodeURI(`/api/push/subscribe`), {
          method: 'POST',
          body: JSON.stringify(subscription),
        })
          .then((res: ResponseWithError) => {
            if (res.error) throw res.error;

            dispatch(subscribeSuccess(subscription));
          })
          .catch((e: unknown) => dispatch(subscribeError(e as StoredError)));
      })
      .catch((e: unknown) => dispatch(subscribeError(e as StoredError)));
  };

export const unsubscribe =
  (): AppThunk<Promise<void | UnsubscribeErrorAction>> =>
  (dispatch, getState) => {
    if (!isAuthenticated(getState())) {
      dispatch(
        unsubscribeError({
          message: 'cannot unsubscribe from push: not logged in',
        })
      );
      return Promise.resolve();
    }

    const { notifications } = getState();

    if (notifications.subscription === null) {
      dispatch(
        unsubscribeError({
          message: 'cannot unsubscribe from push: not subscribed',
        })
      );
      return Promise.resolve();
    }

    dispatch(unsubscribeRequest());
    return fetch(encodeURI(`/api/push/unsubscribe`), {
      method: 'POST',
      body: JSON.stringify(notifications.subscription),
    })
      .then((res: ResponseWithError) => {
        if (res.error) throw res.error;

        dispatch(unsubscribeSuccess());
      })
      .catch((e: unknown) => dispatch(unsubscribeError(e as StoredError)));
  };

export type NotificationsAction =
  | UpdateRegistrationAction
  | UpdateAvailableAction
  | IgnoreUpdateAction
  | SubscribeRequestAction
  | SubscribeSuccessAction
  | SubscribeErrorAction
  | UnsubscribeRequestAction
  | UnsubscribeSuccessAction
  | UnsubscribeErrorAction;
