import { map } from 'lodash';

import getPlotData from '../selectors/portfolio-plot';

export const FETCH_PORTFOLIO_PLOT_REQUEST = 'FETCH_PORTFOLIO_PLOT_REQUEST';
export const fetchPortfolioPlotRequest = (startDate, endDate) => ({
  type: FETCH_PORTFOLIO_PLOT_REQUEST,
  startDate,
  endDate,
});

export const FETCH_PORTFOLIO_PLOT_SUCCESS = 'FETCH_PORTFOLIO_PLOT_SUCCESS';
export const fetchPortfolioPlotSuccess = (startDate, endDate, json) => ({
  type: FETCH_PORTFOLIO_PLOT_SUCCESS,
  data: json,
  startDate,
  endDate,
  receivedAt: Date.now(),
});

export const FETCH_PORTFOLIO_PLOT_ERROR = 'FETCH_PORTFOLIO_PLOT_ERROR';
export const fetchPortfolioPlotError = (startDate, endDate, e) => ({
  type: FETCH_PORTFOLIO_PLOT_ERROR,
  error: e,
  startDate,
  endDate,
  receivedAt: Date.now(),
});

export const fetchPortfolioPlot = (startDate, endDate) => dispatch => {
  dispatch(fetchPortfolioPlotRequest(startDate, endDate));

  return fetch(
    `/api/analysis/plots/portfolio?start=${startDate}&end=${endDate}`
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
        earningArea: p.value !== null ? [p.invested, p.value] : null,
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

      dispatch(fetchPortfolioPlotSuccess(startDate, endDate, res));
    })
    .catch(e => dispatch(fetchPortfolioPlotError(startDate, endDate, e)));
};

export const updatePortfolioPlot = (startDate, endDate) => (
  dispatch,
  getState
) => {
  const data = getPlotData(getState(), startDate, endDate);

  if (
    data === null ||
    (!data.isFetching &&
      (data.lastUpdated === null ||
        Date.now() - data.lastUpdated >= 60 * 60 * 1e3))
  )
    return dispatch(fetchPortfolioPlot(startDate, endDate));

  return Promise.resolve();
};
