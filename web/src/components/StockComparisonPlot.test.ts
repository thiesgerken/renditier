import type { StoredStockPlotPoint } from '../types/store';
import { unifyPoints } from './StockComparisonPlot';

const point = (day: number, priceRelStart: number) =>
  ({
    date: `2026-03-0${day}T16:00:00Z`,
    epoch: day,
    priceRelStart,
  }) as StoredStockPlotPoint;

describe('unifyPoints', () => {
  it('merges the series by date', () => {
    const points = {
      A: [point(1, 0), point(2, 1), point(3, 2)],
      B: [point(2, 0), point(4, 5)],
      C: [],
    };

    expect(unifyPoints(points, ['A', 'B', 'C'])).toEqual([
      { date: '2026-03-01T16:00:00Z', epoch: 1, A: 0, B: null },
      { date: '2026-03-02T16:00:00Z', epoch: 2, A: 1, B: 0 },
      { date: '2026-03-03T16:00:00Z', epoch: 3, A: 2, B: null },
      { date: '2026-03-04T16:00:00Z', epoch: 4, B: 5 },
    ]);
  });
});
