import { map } from 'lodash';
import moment from 'moment';

import getPlotData from '../selectors/portfolioPlot';
import type { AppThunk } from '../types/actions';
import type { DataSourceSelection, IsoDate, PortfolioPlot } from '../types/api';
import type {
  StoredError,
  StoredPortfolioPlot,
  Timestamp,
} from '../types/store';

export const FETCH_PORTFOLIO_PLOT_REQUEST = 'FETCH_PORTFOLIO_PLOT_REQUEST';
export interface FetchPortfolioPlotRequestAction {
  type: typeof FETCH_PORTFOLIO_PLOT_REQUEST;
  startDate: IsoDate;
  endDate: IsoDate;
  source: DataSourceSelection;
}
export const fetchPortfolioPlotRequest = (
  startDate: IsoDate,
  endDate: IsoDate,
  source: DataSourceSelection
): FetchPortfolioPlotRequestAction => ({
  type: FETCH_PORTFOLIO_PLOT_REQUEST,
  startDate,
  endDate,
  source,
});

export const FETCH_PORTFOLIO_PLOT_SUCCESS = 'FETCH_PORTFOLIO_PLOT_SUCCESS';
export interface FetchPortfolioPlotSuccessAction {
  type: typeof FETCH_PORTFOLIO_PLOT_SUCCESS;
  data: StoredPortfolioPlot;
  startDate: IsoDate;
  endDate: IsoDate;
  source: DataSourceSelection;
  receivedAt: Timestamp;
}
export const fetchPortfolioPlotSuccess = (
  startDate: IsoDate,
  endDate: IsoDate,
  source: DataSourceSelection,
  json: StoredPortfolioPlot
): FetchPortfolioPlotSuccessAction => ({
  type: FETCH_PORTFOLIO_PLOT_SUCCESS,
  data: json,
  startDate,
  endDate,
  source,
  receivedAt: Date.now(),
});

export const FETCH_PORTFOLIO_PLOT_ERROR = 'FETCH_PORTFOLIO_PLOT_ERROR';
export interface FetchPortfolioPlotErrorAction {
  type: typeof FETCH_PORTFOLIO_PLOT_ERROR;
  error: StoredError;
  startDate: IsoDate;
  endDate: IsoDate;
  source: DataSourceSelection;
  receivedAt: Timestamp;
}
export const fetchPortfolioPlotError = (
  startDate: IsoDate,
  endDate: IsoDate,
  source: DataSourceSelection,
  e: StoredError
): FetchPortfolioPlotErrorAction => ({
  type: FETCH_PORTFOLIO_PLOT_ERROR,
  error: e,
  startDate,
  endDate,
  source,
  receivedAt: Date.now(),
});

export type PortfolioPlotAction =
  | FetchPortfolioPlotRequestAction
  | FetchPortfolioPlotSuccessAction
  | FetchPortfolioPlotErrorAction;

// The `.catch` arm resolves to the dispatched error action, so neither thunk
// resolves to plain `void`.
type PortfolioPlotThunkResult = Promise<void | FetchPortfolioPlotErrorAction>;

export const fetchPortfolioPlot =
  (
    startDate: IsoDate,
    endDate: IsoDate,
    source: DataSourceSelection
  ): AppThunk<PortfolioPlotThunkResult> =>
  dispatch => {
    dispatch(fetchPortfolioPlotRequest(startDate, endDate, source));

    return fetch(
      `/api/analysis/plots/portfolio?start=${startDate}&end=${endDate}&source=${source}`
    )
      .then(res => {
        if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<PortfolioPlot & { error?: StoredError }>;
      })
      .then(res => {
        if (res.error) throw res.error;

        // preprocess the data
        const decorated = map(res.points, p => ({
          ...p,
          earnings: p.value !== null ? p.value - p.invested : null,
          earningsRelInvested:
            p.value !== null && p.invested !== 0
              ? ((p.value - p.invested) / p.invested) * 100
              : null,
          epoch: moment(p.date).valueOf(),
        }));

        // The original read `res.points[0]` inside the callback below, i.e. only
        // ever when there is at least one point; hoisting it changes nothing.
        const first = decorated[0];
        const points = map(decorated, p => ({
          ...p,
          // `p.value` is coerced to 0 by the original subtraction when null.
          valueRelStart:
            first.value !== null && first.value > 0
              ? (((p.value ?? 0) - first.value) / first.value) * 100
              : null,
          investedRelStart:
            first.invested > 0
              ? ((p.invested - first.invested) / first.invested) * 100
              : null,
        }));

        let i = 0;
        while (
          points.length > 0 &&
          points.slice(-1)[0].value === null &&
          i < 5
        ) {
          points.pop();
          i += 1;
        }

        dispatch(
          fetchPortfolioPlotSuccess(startDate, endDate, source, {
            ...res,
            points,
          })
        );
      })
      .catch(e =>
        dispatch(fetchPortfolioPlotError(startDate, endDate, source, e))
      );
  };

export const updatePortfolioPlot =
  (
    startDate: IsoDate | null,
    endDate: IsoDate | null,
    source: DataSourceSelection | null
  ): AppThunk<PortfolioPlotThunkResult> =>
  (dispatch, getState) => {
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
