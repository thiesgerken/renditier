import type { DataSourceSelection, IsoDate } from '../types/api';
import type { PortfolioPlotItem, RootState } from '../types/store';

export default function getPlotData(
  state: RootState,
  startDate: IsoDate,
  endDate: IsoDate,
  source: DataSourceSelection
): PortfolioPlotItem | null {
  const { portfolioPlot } = state;

  let item: PortfolioPlotItem | null = null;

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
