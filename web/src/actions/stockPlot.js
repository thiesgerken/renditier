import { map } from 'lodash';
import moment from 'moment';

import getPlotData from '../selectors/stockPlot';

export const FETCH_STOCK_PLOT_REQUEST = 'FETCH_STOCK_PLOT_REQUEST';
export const fetchStockPlotRequest = (isin, startDate, endDate, source) => ({
  type: FETCH_STOCK_PLOT_REQUEST,
  isin,
  startDate,
  endDate,
  source,
});

export const FETCH_STOCK_PLOT_SUCCESS = 'FETCH_STOCK_PLOT_SUCCESS';
export const fetchStockPlotSuccess = (
  isin,
  startDate,
  endDate,
  source,
  json
) => ({
  type: FETCH_STOCK_PLOT_SUCCESS,
  data: json,
  isin,
  startDate,
  endDate,
  source,
  receivedAt: Date.now(),
});

export const FETCH_STOCK_PLOT_ERROR = 'FETCH_STOCK_PLOT_ERROR';
export const fetchStockPlotError = (isin, startDate, endDate, source, e) => ({
  type: FETCH_STOCK_PLOT_ERROR,
  error: e,
  isin,
  startDate,
  endDate,
  source,
  receivedAt: Date.now(),
});

export const fetchStockPlot = (
  isin,
  startDate,
  endDate,
  source
) => dispatch => {
  dispatch(fetchStockPlotRequest(isin, startDate, endDate, source));

  return fetch(
    `/api/analysis/plots/${isin}?start=${startDate}&end=${endDate}&source=${source}`
  )
    .then(res => {
      if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
      return res.json();
    })
    .then(res => {
      if (res.error) throw res.error;

      // preprocess the data
      res.points = map(res.points, p => ({
        ...p,
        earnings: p.value !== null ? p.value - p.invested : null,
        earningsRelInvestment:
          p.value !== null && p.invested !== 0
            ? ((p.value - p.invested) / p.invested) * 100
            : null,
        epoch: moment(p.date).valueOf(),
      }));

      res.points = map(res.points, p => ({
        ...p,
        valueRelStart:
          res.points[0].value > 0
            ? ((p.value - res.points[0].value) / res.points[0].value) * 100
            : null,
        investedRelStart:
          res.points[0].invested > 0
            ? ((p.invested - res.points[0].invested) / res.points[0].invested) *
              100
            : null,
        priceRelStart:
          res.points[0].price > 0
            ? ((p.price - res.points[0].price) / res.points[0].price) * 100
            : null,
      }));

      let i = 0;
      while (
        res.points.length > 0 &&
        res.points.slice(-1)[0].value === null &&
        i < 5
      ) {
        res.points.pop();
        i += 1;
      }

      dispatch(fetchStockPlotSuccess(isin, startDate, endDate, source, res));
    })
    .catch(e =>
      dispatch(fetchStockPlotError(isin, startDate, endDate, source, e))
    );
};

export const updateStockPlot = (isin, startDate, endDate, source) => (
  dispatch,
  getState
) => {
  if (
    isin === null ||
    startDate === null ||
    endDate === null ||
    source === null
  )
    return Promise.resolve();

  const data = getPlotData(getState(), isin, startDate, endDate, source);

  if (
    data === null ||
    (!data.isFetching &&
      (data.lastUpdated === null ||
        Date.now() - data.lastUpdated >= 60 * 60 * 1e3))
  )
    return dispatch(fetchStockPlot(isin, startDate, endDate, source));

  return Promise.resolve();
};
