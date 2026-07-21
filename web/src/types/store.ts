// Redux state shapes. Every slice's state lives here so that `RootState` can be
// written explicitly instead of inferred from the reducers — that keeps the
// reducers importing from this file and nothing importing back out of them.

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

// Everything the app puts in `error` fields comes from either a thrown Error, a
// rejected fetch, or a `{ message }` literal constructed inline by an action.
export interface ErrorLike {
  message: string;
}

export type StoredError = Error | ErrorLike;

// --------------------------------------------------------------------------
// Generic API resource slice (src/apiResources.ts)
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

export type ModifyMethod = 'POST' | 'PUT' | 'DELETE';

export interface AccountsState {
  isFetching: boolean;
  didInvalidate: boolean;
  items: Account[];
  fetchError: StoredError | null;
  lastUpdated: Timestamp | null;
  isModifying: boolean;
  modifyError: StoredError | null;
}

export interface TransactionsState {
  isFetching: boolean;
  didInvalidate: boolean;
  items: Transaction[];
  fetchError: StoredError | null;
  lastUpdated: Timestamp | null;
  isModifying: boolean;
  modifyError: StoredError | null;
}

export interface AuthenticationState {
  isFetching: boolean;
  didInvalidate: boolean;
  userInfo: UserInfoState | null;
  lastUpdated: Timestamp | null;
  error: StoredError | null;
  message: string | null;
  messageType: 'error' | 'success' | null;
  loginAttempted: boolean;
}

// The stored user info is whatever GET /api/user or POST /api/user/login
// returned; see `UserInfo` in ./api.
export type UserInfoState = UserInfo;

export interface NotificationsState {
  registration: ServiceWorkerRegistration | null;
  subscribing: boolean;
  subscribeError: StoredError | null;
  subscription: PushSubscription | null;
  unsubscribing: boolean;
  unsubscribeError: StoredError | null;
  updateAvailable: boolean;
  updateIgnored: boolean;
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

// --------------------------------------------------------------------------

export interface RootState {
  authentication: AuthenticationState;
  notifications: NotificationsState;
  portfolioPlot: PortfolioPlotState;
  stockPlot: StockPlotState;
  accounts: AccountsState;
  transactions: TransactionsState;
  receipts: ReceiptsState;
  performance: PerformanceState;
  stocks: StocksState;
}
