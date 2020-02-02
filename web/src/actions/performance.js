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
});

export const INVALIDATE_PERFORMANCE = 'INVALIDATE_PERFORMANCE';
export const invalidatePerformance = () => ({
  type: INVALIDATE_PERFORMANCE,
});

export const fetchPerformance = () => dispatch => {
  dispatch(fetchPerformanceRequest());
  return fetch('/api/analysis/performance')
    .then(res => res.json())
    .then(res => {
      if (res.error) throw res.error;

      dispatch(fetchPerformanceSuccess(res));
    })
    .catch(e => dispatch(fetchPerformanceError(e)));
};
