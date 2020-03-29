export default function getPlotData(state, startDate, endDate, source) {
  const { portfolioPlot } = state;

  let item = null;

  portfolioPlot.items.forEach(v => {
    if (
      v.startDate === startDate &&
      v.endDate === endDate &&
      v.source === source
    )
      item = v;
  });

  return item;
}
