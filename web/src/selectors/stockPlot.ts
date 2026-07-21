import type { DataSourceSelection, IsoDate } from '../types/api';
import type { RootState, StockPlotItem } from '../types/store';

export default function getPlotData(
  state: RootState,
  isin: string,
  startDate: IsoDate,
  endDate: IsoDate,
  source: DataSourceSelection
): StockPlotItem | null {
  const { stockPlot } = state;

  let item: StockPlotItem | null = null;

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
