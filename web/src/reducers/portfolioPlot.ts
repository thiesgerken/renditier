import {
  FETCH_PORTFOLIO_PLOT_REQUEST,
  FETCH_PORTFOLIO_PLOT_ERROR,
  FETCH_PORTFOLIO_PLOT_SUCCESS,
} from '../actions/portfolioPlot';
import type { AppAction } from '../types/actions';
import type { DataSourceSelection, IsoDate } from '../types/api';
import type { PortfolioPlotItem, PortfolioPlotState } from '../types/store';

const insertItem = (
  items: PortfolioPlotItem[],
  startDate: IsoDate,
  endDate: IsoDate,
  source: DataSourceSelection
): number => {
  let idx = -1;

  items.forEach((v, i) => {
    if (
      v.startDate === startDate &&
      v.endDate === endDate &&
      v.source === source
    )
      idx = i;
  });

  if (idx >= 0) return idx;

  return (
    items.push({
      startDate,
      endDate,
      source,
      isFetching: false,
      error: null,
      lastUpdated: null,
      data: null,
    }) - 1
  );
};

const portfolioPlot = (
  state: PortfolioPlotState = {
    items: [],
  },
  action: AppAction
): PortfolioPlotState => {
  switch (action.type) {
    case FETCH_PORTFOLIO_PLOT_REQUEST: {
      const items = state.items.slice();
      const idx = insertItem(
        items,
        action.startDate,
        action.endDate,
        action.source
      );
      items[idx].isFetching = true;

      return { ...state, items };
    }
    case FETCH_PORTFOLIO_PLOT_SUCCESS: {
      const items = state.items.slice();
      const idx = insertItem(
        items,
        action.startDate,
        action.endDate,
        action.source
      );
      items[idx].isFetching = false;
      items[idx].data = action.data;
      items[idx].error = null;
      items[idx].lastUpdated = action.receivedAt;

      return { ...state, items };
    }
    case FETCH_PORTFOLIO_PLOT_ERROR: {
      const items = state.items.slice();
      const idx = insertItem(
        items,
        action.startDate,
        action.endDate,
        action.source
      );
      items[idx].isFetching = false;
      items[idx].error = action.error;
      items[idx].lastUpdated = action.receivedAt;

      return { ...state, items };
    }
    default:
      return state;
  }
};

export default portfolioPlot;
