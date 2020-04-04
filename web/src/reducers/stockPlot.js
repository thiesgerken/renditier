import {
  FETCH_STOCK_PLOT_REQUEST,
  FETCH_STOCK_PLOT_ERROR,
  FETCH_STOCK_PLOT_SUCCESS,
} from '../actions/stockPlot';

const insertItem = (items, isin, startDate, endDate, source) => {
  let idx = -1;

  items.forEach((v, i) => {
    if (
      v.startDate === startDate &&
      v.endDate === endDate &&
      v.source === source &&
      v.isin === isin
    )
      idx = i;
  });

  if (idx >= 0) return idx;

  return (
    items.push({
      isin,
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

const stockPlot = (
  state = {
    items: [],
  },
  action
) => {
  switch (action.type) {
    case FETCH_STOCK_PLOT_REQUEST: {
      const items = state.items.slice();
      const idx = insertItem(
        items,
        action.isin,
        action.startDate,
        action.endDate,
        action.source
      );
      items[idx].isFetching = true;

      return { ...state, items };
    }
    case FETCH_STOCK_PLOT_SUCCESS: {
      const items = state.items.slice();
      const idx = insertItem(
        items,
        action.isin,
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
    case FETCH_STOCK_PLOT_ERROR: {
      const items = state.items.slice();
      const idx = insertItem(
        items,
        action.isin,
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

export default stockPlot;
