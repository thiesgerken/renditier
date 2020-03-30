export default function getPlotData(state, isin, startDate, endDate, source) {
  const { stockPlot } = state;

  let item = null;

  stockPlot.items.forEach(v => {
    if (
      v.startDate === startDate &&
      v.endDate === endDate &&
      v.source === source &&
      v.isin === isin
    )
      item = v;
  });

  return item;
}
