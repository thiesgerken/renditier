import type { StockReturns } from '../types/api';
import { createResourceSlice } from './resource';

const stockReturns = createResourceSlice<Record<string, StockReturns>>(
  'stockReturns',
  '/api/stocks/returns'
);

export default stockReturns.reducer;
export const fetchStockReturns = stockReturns.fetch;
export const retryStockReturns = stockReturns.retry;
