export const FETCH_RESOURCE_REQUEST = res =>
  `FETCH_${res.name.toUpperCase()}_REQUEST`;
export const FETCH_RESOURCE_SUCCESS = res =>
  `FETCH_${res.name.toUpperCase()}_SUCCESS`;
export const FETCH_RESOURCE_ERROR = res =>
  `FETCH_${res.name.toUpperCase()}_ERROR`;
export const INVALIDATE_RESOURCE = res =>
  `INVALIDATE_${res.name.toUpperCase()}`;

export const fetchResourceRequest = res => () => ({
  type: FETCH_RESOURCE_REQUEST(res),
});

export const fetchResourceSuccess = res => json => ({
  type: FETCH_RESOURCE_SUCCESS(res),
  data: json,
  receivedAt: Date.now(),
});

export const fetchResourceError = res => e => ({
  type: FETCH_RESOURCE_ERROR(res),
  error: e,
  receivedAt: Date.now(),
});

export const invalidateResource = res => () => ({
  type: INVALIDATE_RESOURCE(res),
});

export const fetchResource = res => () => dispatch => {
  dispatch(fetchResourceRequest(res)());
  return fetch(encodeURI(res.url))
    .then(resp => {
      if (!resp.ok) throw Error(`${resp.status} ${resp.statusText}`);
      return resp.json();
    })
    .then(resp => {
      if (resp.error) throw resp.error;

      dispatch(fetchResourceSuccess(res)(resp));
    })
    .catch(e => dispatch(fetchResourceError(res)(e)));
};

export const updateResource = res => () => (dispatch, getState) => {
  const resource = getState()[res.name];

  if (
    !resource.didInvalidate &&
    resource.lastRequest !== null &&
    Date.now() - resource.lastRequest > 60 * 60 * 1e3
  )
    dispatch(invalidateResource(res)());

  if (
    !resource.isFetching &&
    ((resource.lastUpdated === null && resource.error === null) ||
      resource.didInvalidate)
  )
    return dispatch(fetchResource(res)());

  return Promise.resolve();
};

export const resourceActions = res => ({
  update: updateResource(res),
  invalidate: invalidateResource(res),
});

export const resourceReducer = res => (
  state = {
    isFetching: false,
    didInvalidate: true,
    data: null,
    error: null,
    lastRequest: null,
  },
  action
) => {
  switch (action.type) {
    case INVALIDATE_RESOURCE(res):
      return { ...state, didInvalidate: true };
    case FETCH_RESOURCE_REQUEST(res):
      return { ...state, isFetching: true };
    case FETCH_RESOURCE_SUCCESS(res):
      return {
        ...state,
        isFetching: false,
        didInvalidate: false,
        data: action.data,
        lastRequest: action.receivedAt,
        error: null,
      };
    case FETCH_RESOURCE_ERROR(res):
      return {
        ...state,
        isFetching: false,
        didInvalidate: true,
        error: action.error,
        lastRequest: action.receivedAt,
      };
    default:
      return state;
  }
};

export const stockResource = { name: 'stocks', url: '/api/stocks' };
export const performanceResource = {
  name: 'performance',
  url: '/api/analysis/performance',
};
