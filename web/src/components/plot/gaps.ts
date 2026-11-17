import { sortBy } from 'lodash';

import type { Trades } from './trades';

// A stretch of intraday data without points, i.e. while the exchanges were
// closed: nights, weekends and holidays.
export interface Gap {
  // epochs of the last point before and the first point after it
  start: number;
  end: number;
}

// Intraday points are sampled on a regular grid during trading hours, so the
// median spacing is the grid's. A missing sample or two stays below this
// factor, while a night spans ten or more grid steps. Data with only an
// opening and a closing price per day has a trading day as its median
// spacing; then only weekends and holidays are gaps.
const GAP_FACTOR = 4;

// Spacings between consecutive points that are much longer than the typical
// one. Exchange hours are deliberately not hardcoded: the data tells when
// the exchanges it comes from were open.
export const findGaps = (epochs: number[]): Gap[] => {
  const spacings = epochs.flatMap((end, i) => {
    const start = epochs[i - 1];
    return start === undefined ? [] : [{ start, end }];
  });
  const lengths = sortBy(spacings.map(s => s.end - s.start));
  const typical = lengths[Math.floor(lengths.length / 2)];
  if (typical === undefined) return [];

  return spacings.filter(s => s.end - s.start > GAP_FACTOR * typical);
};

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
