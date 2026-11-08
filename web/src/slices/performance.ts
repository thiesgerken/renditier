import type { PortfolioPerformance } from '../types/api';
import { createResourceSlice } from './resource';

const performance = createResourceSlice<PortfolioPerformance[]>(
  'performance',
  '/api/analysis/performance'
);

export default performance.reducer;
export const fetchPerformance = performance.fetch;
export const retryPerformance = performance.retry;
export const invalidatePerformance = performance.invalidate;
