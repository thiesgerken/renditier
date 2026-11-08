import type { Stock } from '../types/api';
import { createResourceSlice } from './resource';

const stocks = createResourceSlice<Stock[]>('stocks', '/api/stocks');

export default stocks.reducer;
export const fetchStocks = stocks.fetch;
export const retryStocks = stocks.retry;
