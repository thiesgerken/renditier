import { assignTrades } from './trades';
import type { Transaction } from '../../types/api';

// local time, like the plots
const local = (s: string) =>
  Temporal.PlainDateTime.from(s).toZonedDateTime(Temporal.Now.timeZoneId());
const at = (s: string) => local(s).epochMilliseconds;

const transaction = (
  date: string,
  units: number,
  cents: number
): Transaction => ({
  id: 0,
  accountId: 0,
  isin: 'IE00BK5BQT80',
  date: local(date).toInstant().toString(),
  units,
  amount: cents,
  fees: -100,
  onvistaExchangeId: null,
  comments: '',
  exchange: null,
  receiptNumber: null,
});

const points = [
  { epoch: at('2026-11-02T18:00') },
  { epoch: at('2026-11-03T18:00') },
  { epoch: at('2026-11-04T18:00') },
];

describe('assignTrades', () => {
  it('attaches trades to the first point at or after them', () => {
    const result = assignTrades(points, [
      transaction('2026-11-02T09:30', 2, -20000),
      transaction('2026-11-03T19:00', 1, -10000),
      transaction('2026-11-04T10:00', -1, 15000),
    ]);

    expect(result.map(p => p.trades)).toEqual([
      { boughtUnits: 2, boughtAmount: 201, soldUnits: 0, soldAmount: 0 },
      null,
      { boughtUnits: 1, boughtAmount: 101, soldUnits: 1, soldAmount: 149 },
    ]);
  });

  it('ignores trades outside the plotted range and dividends', () => {
    const result = assignTrades(points, [
      transaction('2026-11-01T10:00', 1, -10000),
      transaction('2026-11-03T10:00', 0, 500),
      transaction('2026-11-05T10:00', 1, -10000),
    ]);

    expect(result.every(p => p.trades === null)).toBe(true);
  });
});
