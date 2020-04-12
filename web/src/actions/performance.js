export const FETCH_PERFORMANCE_REQUEST = 'FETCH_PERFORMANCE_REQUEST';
export const fetchPerformanceRequest = () => ({
  type: FETCH_PERFORMANCE_REQUEST,
});

export const FETCH_PERFORMANCE_SUCCESS = 'FETCH_PERFORMANCE_SUCCESS';
export const fetchPerformanceSuccess = json => ({
  type: FETCH_PERFORMANCE_SUCCESS,
  data: json,
  receivedAt: Date.now(),
});

export const FETCH_PERFORMANCE_ERROR = 'FETCH_PERFORMANCE_ERROR';
export const fetchPerformanceError = e => ({
  type: FETCH_PERFORMANCE_ERROR,
  error: e,
  receivedAt: Date.now(),
});

export const INVALIDATE_PERFORMANCE = 'INVALIDATE_PERFORMANCE';
export const invalidatePerformance = () => ({
  type: INVALIDATE_PERFORMANCE,
});

export const fetchPerformance = () => dispatch => {
  dispatch(fetchPerformanceRequest());
  return fetch('/api/analysis/performance')
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res.json();
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(fetchPerformanceSuccess(res));
    })
    .catch(e => dispatch(fetchPerformanceError(e)));
};

export const updatePerformance = () => (dispatch, getState) => {
  const { performance } = getState();

  if (
    !performance.didInvalidate &&
    performance.lastUpdated !== null &&
    Date.now() - performance.lastUpdated > 60 * 60 * 1e3
  )
    dispatch(invalidatePerformance());

  if (
    !performance.isFetching &&
    ((performance.lastUpdated === null && performance.error === null) ||
      performance.didInvalidate)
  )
    return dispatch(fetchPerformance());

  return Promise.resolve();
};
