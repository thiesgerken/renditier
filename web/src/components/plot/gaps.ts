import { sameDay } from './axes';
import type { Trades } from './trades';

// A stretch of intraday data without points, i.e. while the exchanges were
// closed: nights, weekends and holidays.
export interface Gap {
  // epochs of the last point before and the first point after it
  start: number;
  end: number;
}

// Intraday points are only sampled during trading hours, as a grid or as the
// opening and closing price of each day, so any step from one day to another
// spans a closure. Missing samples within a day are not one. Exchange hours
// are deliberately not hardcoded: a portfolio mixes exchanges.
export const findGaps = (epochs: number[]): Gap[] =>
  epochs.flatMap((end, i) => {
    const start = epochs[i - 1];
    return start === undefined || sameDay(start, end) ? [] : [{ start, end }];
  });

// A point, or a copy of one that holds its values over a gap.
export type Held<P> = P & { heldFrom?: P };

// Inserts a copy of the last point before each gap just before the gap ends,
// so that the lines stay flat while the exchanges are closed and jump when
// they reopen, instead of a diagonal suggesting movement in between. The copy
// carries no trades, so that they are marked only once, and `heldFrom` names
// the real point for the tooltip.
export const holdOverGaps = <
  P extends { epoch: number; trades: Trades | null },
>(
  points: P[],
  gaps: Gap[]
): Held<P>[] => {
  const gapEnds = new Set(gaps.map(g => g.end));

  return points.flatMap((point, i) => {
    const previous = points[i - 1];
    if (previous === undefined || !gapEnds.has(point.epoch)) return [point];

    const held: Held<P> = {
      ...previous,
      epoch: point.epoch - 1,
      trades: null,
      heldFrom: previous,
    };
    return [held, point];
  });
};
