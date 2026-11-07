import { sortBy } from 'lodash';

import type { Transaction } from '../../types/api';

// Buys and sells that happened up to a plot point (and after the previous one).
// Amounts are in euros including fees.
export interface Trades {
  boughtUnits: number;
  boughtAmount: number;
  soldUnits: number;
  soldAmount: number;
}

const NO_TRADES: Trades = {
  boughtUnits: 0,
  boughtAmount: 0,
  soldUnits: 0,
  soldAmount: 0,
};

const addTrade = (trades: Trades, t: Transaction): Trades => {
  const amount = (t.amount + t.fees) / 100;

  return t.units > 0
    ? {
        ...trades,
        boughtUnits: trades.boughtUnits + t.units,
        boughtAmount: trades.boughtAmount - amount,
      }
    : {
        ...trades,
        soldUnits: trades.soldUnits - t.units,
        soldAmount: trades.soldAmount + amount,
      };
};

// Attaches every buy and sell to the first point at or after it, which is
// where its effect on the invested amount shows up. Plotted ranges consist of
// whole days, so a trade on the first day belongs to the range even when it
// happened before that day's first point (its close, or its opening for
// intraday data); it then shows up at that first point. Dividends (no units)
// are not trades.
export const assignTrades = <P extends { epoch: number }>(
  points: P[],
  transactions: Transaction[]
): (P & { trades: Trades | null })[] => {
  const result = points.map(p => ({ ...p, trades: null as Trades | null }));
  if (result.length === 0) return result;

  const rangeStart = Temporal.Instant.fromEpochMilliseconds(result[0].epoch)
    .toZonedDateTimeISO(Temporal.Now.timeZoneId())
    .startOfDay().epochMilliseconds;
  const epochOf = (t: Transaction) =>
    Temporal.Instant.from(t.date).epochMilliseconds;
  let i = 0;

  sortBy(transactions, epochOf).forEach(t => {
    const epoch = epochOf(t);
    if (t.units === 0 || epoch < rangeStart) return;

    while (i < result.length && result[i].epoch < epoch) i += 1;
    if (i === result.length) return;

    result[i].trades = addTrade(result[i].trades ?? NO_TRADES, t);
  });

  return result;
};
