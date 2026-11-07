// Redux state shapes, declared rather than inferred from the slices so that the
// nullable fields are explicit and components can type their props with them.

import type { SerializedError } from '@reduxjs/toolkit';

import type {
  Account,
  DataSourceSelection,
  IsoDate,
  PortfolioPerformance,
  PortfolioPlot,
  PortfolioPlotDataPoint,
  Stock,
  StockPlot,
  StockPlotDataPoint,
  Transaction,
  UserInfo,
} from './api';

// Epoch milliseconds, as produced by Date.now().
export type Timestamp = number;

// What createAsyncThunk makes of whatever a thunk threw.
export type StoredError = SerializedError;

// --------------------------------------------------------------------------
// Generic API resource slice (src/slices/resource.ts)
// --------------------------------------------------------------------------

export interface ResourceState<T> {
  isFetching: boolean;
  didInvalidate: boolean;
  data: T | null;
  error: StoredError | null;
  lastRequest: Timestamp | null;
}

export type StocksState = ResourceState<Stock[]>;
export type PerformanceState = ResourceState<PortfolioPerformance[]>;

// --------------------------------------------------------------------------
// Hand-written slices
// --------------------------------------------------------------------------

export interface AccountsState {
  isFetching: boolean;
  didInvalidate: boolean;
  items: Account[];
  fetchError: StoredError | null;
  lastUpdated: Timestamp | null;
}

export interface TransactionsState {
  isFetching: boolean;
  didInvalidate: boolean;
  items: Transaction[];
  fetchError: StoredError | null;
  lastUpdated: Timestamp | null;
}

export interface AuthenticationState {
  isFetching: boolean;
  userInfo: UserInfoState | null;
  error: StoredError | null;
  message: string | null;
  messageType: 'error' | 'success' | null;
  loginAttempted: boolean;
}

// The stored user info is whatever GET /api/user or POST /api/user/login
// returned; see `UserInfo` in ./api.
export type UserInfoState = UserInfo;

export interface NotificationsState {
  updateAvailable: boolean;
  updateIgnored: boolean;
}

// The dashboard's period, as a periodKey (see selectors/performance).
export interface PeriodState {
  selected: string;
}

// POST /api/receipts returns one entry per uploaded file.
export interface ReceiptsState {
  isUploading: boolean;
  data: Transaction[] | null;
  uploadError: StoredError | null;
  lastUpload: Timestamp | null;
}

// --------------------------------------------------------------------------
// Plot slices
// --------------------------------------------------------------------------
// The plot thunks decorate every data point with derived fields before the
// reducer stores them, so what lands in the store is wider than the raw API
// payload.

export interface DerivedPlotFields {
  earnings: number | null;
  // moment(point.date).valueOf()
  epoch: number;
  valueRelStart: number | null;
  investedRelStart: number | null;
}

// The two thunks do NOT agree on the name of the earnings ratio: the portfolio
// plot writes `earningsRelInvested`, the stock plot `earningsRelInvestment`.
// Both names are read by their respective components, so they are kept apart.
export type StoredPortfolioPlotPoint = PortfolioPlotDataPoint &
  DerivedPlotFields & {
    earningsRelInvested: number | null;
  };

export type StoredPortfolioPlot = Omit<PortfolioPlot, 'points'> & {
  points: StoredPortfolioPlotPoint[];
};

export type StoredStockPlotPoint = StockPlotDataPoint &
  DerivedPlotFields & {
    earningsRelInvestment: number | null;
    // Only the stock plot derives this one.
    priceRelStart: number | null;
  };

export type StoredStockPlot = Omit<StockPlot, 'points'> & {
  points: StoredStockPlotPoint[];
};

// One cache entry per (range, source) tuple the UI has asked for.
interface PlotCacheEntry<T> {
  startDate: IsoDate;
  endDate: IsoDate;
  source: DataSourceSelection;
  isFetching: boolean;
  error: StoredError | null;
  lastUpdated: Timestamp | null;
  data: T | null;
}

export type PortfolioPlotItem = PlotCacheEntry<StoredPortfolioPlot>;

export type StockPlotItem = PlotCacheEntry<StoredStockPlot> & {
  isin: string;
};

export interface PortfolioPlotState {
  items: PortfolioPlotItem[];
}

export interface StockPlotState {
  items: StockPlotItem[];
}
