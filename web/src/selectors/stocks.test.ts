import type { Stock } from '../types/api';
import { breakdownShares, holdingShares } from './stocks';

// onvista stores the JSON `null` for some funds instead of leaving the column
// empty; both must read as "no data".
const stock = (raw: string | null) =>
  ({ currencyBreakdown: raw, holdings: raw }) as Stock;

describe('onvista columns', () => {
  it.each([null, 'null'])('treat %s as no data', raw => {
    expect(breakdownShares(stock(raw), 'currencyBreakdown')).toEqual([]);
    expect(holdingShares(stock(raw))).toBeNull();
  });

  it('normalizes breakdown names', () => {
    const raw = JSON.stringify([
      { nameBreakdown: 'Vereinigte Staaten', investmentPct: 60 },
    ]);

    expect(breakdownShares(stock(raw), 'currencyBreakdown')).toEqual([
      { label: 'USA', value: 60 },
    ]);
  });
});
