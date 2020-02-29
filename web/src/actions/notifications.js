import { isAuthenticated } from '../selectors/authentication';

export const UPDATE_REGISTRATION = 'UPDATE_REGISTRATION';
export const updateRegistration = registration => ({
  type: UPDATE_REGISTRATION,
  registration,
});

export const SUBSCRIBE_REQUEST = 'SUBSCRIBE_REQUEST';
export const subscribeRequest = () => ({
  type: SUBSCRIBE_REQUEST,
});

export const SUBSCRIBE_SUCCESS = 'SUBSCRIBE_SUCCESS';
export const subscribeSuccess = subscription => ({
  type: SUBSCRIBE_SUCCESS,
  date: Date.now(),
  subscription,
});

export const SUBSCRIBE_ERROR = 'SUBSCRIBE_ERROR';
export const subscribeError = e => ({
  type: SUBSCRIBE_ERROR,
  error: e,
  date: Date.now(),
});

export const UNSUBSCRIBE_REQUEST = 'UNSUBSCRIBE_REQUEST';
export const unsubscribeRequest = () => ({
  type: UNSUBSCRIBE_REQUEST,
});

export const UNSUBSCRIBE_SUCCESS = 'UNSUBSCRIBE_SUCCESS';
export const unsubscribeSuccess = () => ({
  type: UNSUBSCRIBE_SUCCESS,
  date: Date.now(),
});

export const UNSUBSCRIBE_ERROR = 'UNSUBSCRIBE_ERROR';
export const unsubscribeError = e => ({
  type: UNSUBSCRIBE_ERROR,
  error: e,
  date: Date.now(),
});

export const subscribe = () => (dispatch, getState) => {
  if (!isAuthenticated(getState())) {
    dispatch(
      subscribeError({ message: 'cannot subscribe to push: not logged in' })
    );
    return Promise.resolve();
  }

  dispatch(subscribeRequest());

  const { notifications } = getState();

  if (notifications.registration === null) {
    dispatch(
      subscribeError({
        message: 'cannot subscribe to push: service worker not registered',
      })
    );
    return Promise.resolve();
  }

  return notifications.registration.pushManager
    .subscribe({
      userVisibleOnly: true,
      applicationServerKey:
        'BCELnMEiw20yErokWA9BteJ28h0HakaGQ1aJ6LCIJEUdPcUALxsjpjdYRkhdGZQm16CZvsoRWlx1OM0WNyTz8w4',
    })
    .then(subscription => {
      fetch(encodeURI(`/api/push/subscribe`), {
        method: 'POST',
        body: JSON.stringify(subscription),
      })
        .then(res => {
          if (res.error) throw res.error;

          dispatch(subscribeSuccess(subscription));
        })
        .catch(e => dispatch(subscribeError(e)));
    })
    .catch(e => dispatch(subscribeError(e)));
};

export const unsubscribe = () => (dispatch, getState) => {
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
    .then(res => {
      if (res.error) throw res.error;

      dispatch(unsubscribeSuccess());
    })
    .catch(e => dispatch(unsubscribeError(e)));
};
