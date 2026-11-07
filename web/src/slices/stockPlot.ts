import { createSlice } from '@reduxjs/toolkit';
import { map } from 'lodash';

import { fetchJson } from '../api';
import type { AppThunk } from '../store';
import type { DataSourceSelection, IsoDate, StockPlot } from '../types/api';
import type {
  StockPlotItem,
  StockPlotState,
  StoredStockPlot,
} from '../types/store';
import { createAppAsyncThunk } from './createAppAsyncThunk';
import { needsFetch } from './freshness';

interface PlotKey {
  isin: string;
  startDate: IsoDate;
  endDate: IsoDate;
  source: DataSourceSelection;
}

const initialState: StockPlotState = { items: [] };

const findItem = (items: StockPlotItem[], key: PlotKey) =>
  items.find(
    v =>
      v.isin === key.isin &&
      v.startDate === key.startDate &&
      v.endDate === key.endDate &&
      v.source === key.source
  );

const decorate = (plot: StockPlot): StoredStockPlot => {
  const decorated = map(plot.points, p => ({
    ...p,
    earnings: p.value !== null ? p.value - p.invested : null,
    earningsRelInvestment:
      p.value !== null && p.invested !== 0
        ? ((p.value - p.invested) / p.invested) * 100
        : null,
    epoch: Temporal.Instant.from(p.date).epochMilliseconds,
  }));

  const first = decorated[0];
  if (first === undefined) return { ...plot, points: [] };

  const points = map(decorated, p => ({
    ...p,
    // A missing value or price counts as 0.
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
  while (points.at(-1)?.value === null && i < 5) {
    points.pop();
    i += 1;
  }

  return { ...plot, points };
};

export const fetchStockPlot = createAppAsyncThunk(
  'stockPlot/fetch',
  async ({ isin, startDate, endDate, source }: PlotKey) =>
    decorate(
      await fetchJson<StockPlot>(
        `/api/analysis/plots/${isin}?start=${startDate}&end=${endDate}&source=${source}`
      )
    ),
  {
    condition: (key, { getState }) => {
      const item = findItem(getState().stockPlot.items, key);
      return item === undefined || needsFetch(item);
    },
  }
);

// The plots ask for data before they know their stock and range.
export const updateStockPlot =
  (
    isin: string | null,
    startDate: IsoDate | null,
    endDate: IsoDate | null,
    source: DataSourceSelection | null
  ): AppThunk =>
  dispatch => {
    if (
      isin !== null &&
      startDate !== null &&
      endDate !== null &&
      source !== null
    )
      void dispatch(fetchStockPlot({ isin, startDate, endDate, source }));
  };

const itemFor = (state: StockPlotState, key: PlotKey) => {
  const existing = findItem(state.items, key);
  if (existing !== undefined) return existing;

  const item: StockPlotItem = {
    ...key,
    isFetching: false,
    error: null,
    lastUpdated: null,
    data: null,
  };
  state.items.push(item);
  return item;
};

const stockPlot = createSlice({
  name: 'stockPlot',
  initialState,
  reducers: {},
  extraReducers: builder => {
    builder
      .addCase(fetchStockPlot.pending, (state, action) => {
        itemFor(state, action.meta.arg).isFetching = true;
      })
      .addCase(fetchStockPlot.fulfilled, (state, action) => {
        const item = itemFor(state, action.meta.arg);
        item.isFetching = false;
        item.data = action.payload;
        item.error = null;
        item.lastUpdated = Date.now();
      })
      .addCase(fetchStockPlot.rejected, (state, action) => {
        const item = itemFor(state, action.meta.arg);
        item.isFetching = false;
        item.error = action.error;
        item.lastUpdated = Date.now();
      });
  },
});

export default stockPlot.reducer;
