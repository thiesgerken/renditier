export const FETCH_STOCKS_REQUEST = 'FETCH_STOCKS_REQUEST';
export const fetchStocksRequest = () => ({
  type: FETCH_STOCKS_REQUEST,
});

export const FETCH_STOCKS_SUCCESS = 'FETCH_STOCKS_SUCCESS';
export const fetchStocksSuccess = json => ({
  type: FETCH_STOCKS_SUCCESS,
  data: json,
  receivedAt: Date.now(),
});

export const FETCH_STOCKS_ERROR = 'FETCH_STOCKS_ERROR';
export const fetchStocksError = e => ({
  type: FETCH_STOCKS_ERROR,
  error: e,
  receivedAt: Date.now(),
});

export const INVALIDATE_STOCKS = 'INVALIDATE_STOCKS';
export const invalidateStocks = () => ({
  type: INVALIDATE_STOCKS,
});

export const fetchStocks = () => dispatch => {
  dispatch(fetchStocksRequest());
  return fetch('/api/stocks')
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res.json();
    })
    .then(res => {
      if (res.error) throw res.error;

      dispatch(fetchStocksSuccess(res));
    })
    .catch(e => dispatch(fetchStocksError(e)));
};

export const updateStocks = () => (dispatch, getState) => {
  const { stocks } = getState();

  if (
    stocks.lastUpdated !== null &&
    Date.now() - stocks.lastUpdated > 60 * 60 * 1e3
  )
    dispatch(invalidateStocks());

  if (
    !stocks.isFetching &&
    ((stocks.lastUpdated === null && stocks.error === null) ||
      stocks.didInvalidate)
  )
    return dispatch(fetchStocks());

  return Promise.resolve();
};
