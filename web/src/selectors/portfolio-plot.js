export default function getPlotData(state, startDate, endDate) {
  const { portfolioPlot } = state;

  let item = null;

  portfolioPlot.items.forEach(v => {
    if (v.startDate === startDate && v.endDate === endDate) item = v;
  });

  return item;
}
