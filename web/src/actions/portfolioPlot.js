import { map } from 'lodash';
import moment from 'moment';

import getPlotData from '../selectors/portfolioPlot';

export const FETCH_PORTFOLIO_PLOT_REQUEST = 'FETCH_PORTFOLIO_PLOT_REQUEST';
export const fetchPortfolioPlotRequest = (startDate, endDate, source) => ({
  type: FETCH_PORTFOLIO_PLOT_REQUEST,
  startDate,
  endDate,
  source,
});

export const FETCH_PORTFOLIO_PLOT_SUCCESS = 'FETCH_PORTFOLIO_PLOT_SUCCESS';
export const fetchPortfolioPlotSuccess = (
  startDate,
  endDate,
  source,
  json
) => ({
  type: FETCH_PORTFOLIO_PLOT_SUCCESS,
  data: json,
  startDate,
  endDate,
  source,
  receivedAt: Date.now(),
});

export const FETCH_PORTFOLIO_PLOT_ERROR = 'FETCH_PORTFOLIO_PLOT_ERROR';
export const fetchPortfolioPlotError = (startDate, endDate, source, e) => ({
  type: FETCH_PORTFOLIO_PLOT_ERROR,
  error: e,
  startDate,
  endDate,
  source,
  receivedAt: Date.now(),
});

export const fetchPortfolioPlot = (startDate, endDate, source) => dispatch => {
  dispatch(fetchPortfolioPlotRequest(startDate, endDate, source));

  return fetch(
    `/api/analysis/plots/portfolio?start=${startDate}&end=${endDate}&source=${source}`
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
        earningsRelInvested:
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

      dispatch(fetchPortfolioPlotSuccess(startDate, endDate, source, res));
    })
    .catch(e =>
      dispatch(fetchPortfolioPlotError(startDate, endDate, source, e))
    );
};

export const updatePortfolioPlot = (startDate, endDate, source) => (
  dispatch,
  getState
) => {
  if (startDate === null || endDate === null || source === null)
    return Promise.resolve();

  const data = getPlotData(getState(), startDate, endDate, source);

  if (
    data === null ||
    (!data.isFetching &&
      (data.lastUpdated === null ||
        Date.now() - data.lastUpdated >= 60 * 60 * 1e3))
  )
    return dispatch(fetchPortfolioPlot(startDate, endDate, source));

  return Promise.resolve();
};
