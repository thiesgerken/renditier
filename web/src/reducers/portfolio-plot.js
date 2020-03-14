import {
  FETCH_PORTFOLIO_PLOT_REQUEST,
  FETCH_PORTFOLIO_PLOT_ERROR,
  FETCH_PORTFOLIO_PLOT_SUCCESS,
} from '../actions/portfolio-plot';

const insertItem = (items, startDate, endDate) => {
  let idx = -1;

  items.forEach((v, i) => {
    if (v.startDate === startDate && v.endDate === endDate) idx = i;
  });

  if (idx >= 0) return idx;

  return (
    items.push({
      startDate,
      endDate,
      isFetching: false,
      error: null,
      lastUpdated: null,
      data: null,
    }) - 1
  );
};

const portfolioPlot = (
  state = {
    items: [],
  },
  action
) => {
  switch (action.type) {
    case FETCH_PORTFOLIO_PLOT_REQUEST: {
      const items = state.items.slice();
      const idx = insertItem(items, action.startDate, action.endDate);
      items[idx].isFetching = true;

      return { ...state, items };
    }
    case FETCH_PORTFOLIO_PLOT_SUCCESS: {
      const items = state.items.slice();
      const idx = insertItem(items, action.startDate, action.endDate);
      items[idx].isFetching = false;
      items[idx].data = action.data;
      items[idx].error = null;
      items[idx].lastUpdated = action.receivedAt;

      return { ...state, items };
    }
    case FETCH_PORTFOLIO_PLOT_ERROR: {
      const items = state.items.slice();
      const idx = insertItem(items, action.startDate, action.endDate);
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
