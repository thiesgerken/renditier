import {
  resourceActions,
  stockResource,
  performanceResource,
} from '../apiResources';

const stockActions = resourceActions(stockResource);
export const invalidateStocks = stockActions.invalidate;
export const updateStocks = stockActions.update;

const performanceActions = resourceActions(performanceResource);
export const invalidatePerformance = performanceActions.invalidate;
export const updatePerformance = performanceActions.update;
