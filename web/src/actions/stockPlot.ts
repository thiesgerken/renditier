import { map } from 'lodash';
import moment from 'moment';

import getPlotData from '../selectors/stockPlot';
import type { AppThunk } from '../types/actions';
import type { DataSourceSelection, IsoDate, StockPlot } from '../types/api';
import type { StoredError, StoredStockPlot, Timestamp } from '../types/store';

export const FETCH_STOCK_PLOT_REQUEST = 'FETCH_STOCK_PLOT_REQUEST';
export interface FetchStockPlotRequestAction {
  type: typeof FETCH_STOCK_PLOT_REQUEST;
  isin: string;
  startDate: IsoDate;
  endDate: IsoDate;
  source: DataSourceSelection;
}
export const fetchStockPlotRequest = (
  isin: string,
  startDate: IsoDate,
  endDate: IsoDate,
  source: DataSourceSelection
): FetchStockPlotRequestAction => ({
  type: FETCH_STOCK_PLOT_REQUEST,
  isin,
  startDate,
  endDate,
  source,
});

export const FETCH_STOCK_PLOT_SUCCESS = 'FETCH_STOCK_PLOT_SUCCESS';
export interface FetchStockPlotSuccessAction {
  type: typeof FETCH_STOCK_PLOT_SUCCESS;
  data: StoredStockPlot;
  isin: string;
  startDate: IsoDate;
  endDate: IsoDate;
  source: DataSourceSelection;
  receivedAt: Timestamp;
}
export const fetchStockPlotSuccess = (
  isin: string,
  startDate: IsoDate,
  endDate: IsoDate,
  source: DataSourceSelection,
  json: StoredStockPlot
): FetchStockPlotSuccessAction => ({
  type: FETCH_STOCK_PLOT_SUCCESS,
  data: json,
  isin,
  startDate,
  endDate,
  source,
  receivedAt: Date.now(),
});

export const FETCH_STOCK_PLOT_ERROR = 'FETCH_STOCK_PLOT_ERROR';
export interface FetchStockPlotErrorAction {
  type: typeof FETCH_STOCK_PLOT_ERROR;
  error: StoredError;
  isin: string;
  startDate: IsoDate;
  endDate: IsoDate;
  source: DataSourceSelection;
  receivedAt: Timestamp;
}
export const fetchStockPlotError = (
  isin: string,
  startDate: IsoDate,
  endDate: IsoDate,
  source: DataSourceSelection,
  e: StoredError
): FetchStockPlotErrorAction => ({
  type: FETCH_STOCK_PLOT_ERROR,
  error: e,
  isin,
  startDate,
  endDate,
  source,
  receivedAt: Date.now(),
});

export type StockPlotAction =
  | FetchStockPlotRequestAction
  | FetchStockPlotSuccessAction
  | FetchStockPlotErrorAction;

// The `.catch` arm resolves to the dispatched error action, so neither thunk
// resolves to plain `void`.
type StockPlotThunkResult = Promise<void | FetchStockPlotErrorAction>;

export const fetchStockPlot =
  (
    isin: string,
    startDate: IsoDate,
    endDate: IsoDate,
    source: DataSourceSelection
  ): AppThunk<StockPlotThunkResult> =>
  dispatch => {
    dispatch(fetchStockPlotRequest(isin, startDate, endDate, source));

    return fetch(
      `/api/analysis/plots/${isin}?start=${startDate}&end=${endDate}&source=${source}`
    )
      .then(res => {
        if (!res.ok) throw Error(`${res.status} ${res.statusText}`);
        return res.json() as Promise<StockPlot & { error?: StoredError }>;
      })
      .then(res => {
        if (res.error) throw res.error;

        // preprocess the data
        const decorated = map(res.points, p => ({
          ...p,
          earnings: p.value !== null ? p.value - p.invested : null,
          earningsRelInvestment:
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
          // `p.value` / `p.price` are coerced to 0 by the original subtractions
          // when they are null.
          valueRelStart:
            first.value !== null && first.value > 0
              ? (((p.value ?? 0) - first.value) / first.value) * 100
              : null,
          investedRelStart:
            first.invested > 0
              ? ((p.invested - first.invested) / first.invested) * 100
              : null,
          priceRelStart:
            first.price !== null && first.price > 0
              ? (((p.price ?? 0) - first.price) / first.price) * 100
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
          fetchStockPlotSuccess(isin, startDate, endDate, source, {
            ...res,
            points,
          })
        );
      })
      .catch(e =>
        dispatch(fetchStockPlotError(isin, startDate, endDate, source, e))
      );
  };

export const updateStockPlot =
  (
    isin: string | null,
    startDate: IsoDate | null,
    endDate: IsoDate | null,
    source: DataSourceSelection | null
  ): AppThunk<StockPlotThunkResult> =>
  (dispatch, getState) => {
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
