import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';
import { map } from 'lodash';

import { fetchJson } from '../api';
import type { AppThunk } from '../store';
import type { DataSourceSelection, IsoDate, PortfolioPlot } from '../types/api';
import type {
  PortfolioPlotItem,
  PortfolioPlotState,
  StoredPortfolioPlot,
} from '../types/store';
import { createAppAsyncThunk } from './createAppAsyncThunk';
import { needsFetch } from './freshness';

interface PlotKey {
  startDate: IsoDate;
  endDate: IsoDate;
  source: DataSourceSelection;
}

const initialState: PortfolioPlotState = { items: [] };

const findItem = (items: PortfolioPlotItem[], key: PlotKey) =>
  items.find(
    v =>
      v.startDate === key.startDate &&
      v.endDate === key.endDate &&
      v.source === key.source
  );

const decorate = (plot: PortfolioPlot): StoredPortfolioPlot => {
  const decorated = map(plot.points, p => ({
    ...p,
    earnings: p.value !== null ? p.value - p.invested : null,
    earningsRelInvested:
      p.value !== null && p.invested !== 0
        ? ((p.value - p.invested) / p.invested) * 100
        : null,
    epoch: Temporal.Instant.from(p.date).epochMilliseconds,
  }));

  const first = decorated[0];
  if (first === undefined) return { ...plot, points: [] };

  const points = map(decorated, p => ({
    ...p,
    // A missing value counts as 0.
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
  while (points.at(-1)?.value === null && i < 5) {
    points.pop();
    i += 1;
  }

  return { ...plot, points };
};

export const fetchPortfolioPlot = createAppAsyncThunk(
  'portfolioPlot/fetch',
  async ({ startDate, endDate, source }: PlotKey) =>
    decorate(
      await fetchJson<PortfolioPlot>(
        `/api/analysis/plots/portfolio?start=${startDate}&end=${endDate}&source=${source}`
      )
    ),
  {
    condition: (key, { getState }) => {
      const item = findItem(getState().portfolioPlot.items, key);
      return item === undefined || needsFetch(item);
    },
  }
);

// The plot asks for data before it knows its range.
export const updatePortfolioPlot =
  (
    startDate: IsoDate | null,
    endDate: IsoDate | null,
    source: DataSourceSelection | null
  ): AppThunk =>
  dispatch => {
    if (startDate !== null && endDate !== null && source !== null)
      void dispatch(fetchPortfolioPlot({ startDate, endDate, source }));
  };

const itemFor = (state: PortfolioPlotState, key: PlotKey) => {
  const existing = findItem(state.items, key);
  if (existing !== undefined) return existing;

  const item: PortfolioPlotItem = {
    ...key,
    isFetching: false,
    error: null,
    lastUpdated: null,
    data: null,
  };
  state.items.push(item);
  return item;
};

const portfolioPlot = createSlice({
  name: 'portfolioPlot',
  initialState,
  reducers: {
    forget: (state, action: PayloadAction<PlotKey>) => {
      const forgotten = findItem(state.items, action.payload);
      state.items = state.items.filter(item => item !== forgotten);
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchPortfolioPlot.pending, (state, action) => {
        const item = itemFor(state, action.meta.arg);
        item.isFetching = true;
        item.error = null;
      })
      .addCase(fetchPortfolioPlot.fulfilled, (state, action) => {
        const item = itemFor(state, action.meta.arg);
        item.isFetching = false;
        item.data = action.payload;
        item.error = null;
        item.lastUpdated = Date.now();
      })
      .addCase(fetchPortfolioPlot.rejected, (state, action) => {
        const item = itemFor(state, action.meta.arg);
        item.isFetching = false;
        item.error = action.error;
        item.lastUpdated = Date.now();
      });
  },
});

// Loads again right away, even though a failed load counts as fresh.
// Takes a stored item as well, but keeps only the key of it.
export const retryPortfolioPlot =
  ({ startDate, endDate, source }: PlotKey): AppThunk =>
  dispatch => {
    const key = { startDate, endDate, source };
    dispatch(portfolioPlot.actions.forget(key));
    void dispatch(fetchPortfolioPlot(key));
  };

export default portfolioPlot.reducer;
