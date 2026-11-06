import moment from 'moment';
import type { unitOfTime } from 'moment';

import { formatCurrency, formatNumber, formatPercent } from '../../format';

type TickUnit = 'hour' | 'day' | 'week' | 'month' | 'year';

const UNIT_MILLIS: Record<TickUnit, number> = {
  hour: 3600e3,
  day: 86400e3,
  week: 7 * 86400e3,
  month: 30.44 * 86400e3,
  year: 365.25 * 86400e3,
};

// Candidate tick spacings, finest first.
const TICK_STEPS: [number, TickUnit][] = [
  [1, 'hour'],
  [2, 'hour'],
  [3, 'hour'],
  [6, 'hour'],
  [12, 'hour'],
  [1, 'day'],
  [2, 'day'],
  [1, 'week'],
  [2, 'week'],
  [1, 'month'],
  [2, 'month'],
  [3, 'month'],
  [6, 'month'],
  [1, 'year'],
  [2, 'year'],
  [5, 'year'],
];

// Upper bound only: recharts drops further ticks when their labels would
// overlap on narrow screens.
const MAX_TICKS = 12;

const unitStart = (unit: TickUnit): unitOfTime.StartOf =>
  unit === 'week' ? 'isoWeek' : unit;

// Position of a tick within its parent period, to align e.g. every third month
// to quarters. Days and weeks have no natural grid to align to.
const alignmentIndex = (t: moment.Moment, unit: TickUnit): number => {
  switch (unit) {
    case 'hour':
      return t.hour();
    case 'month':
      return t.month();
    case 'year':
      return t.year();
    default:
      return 0;
  }
};

const tickFormat = (unit: TickUnit, spansDays: boolean): string => {
  switch (unit) {
    case 'hour':
      return spansDays ? 'dd., LT' : 'LT';
    case 'day':
    case 'week':
      return 'DD.MM.';
    case 'month':
      return 'MMM YYYY';
    default:
      return 'YYYY';
  }
};

export interface TimeAxis {
  ticks: number[];
  format: (epoch: number) => string;
}

// Calendar-aligned ticks between two epochs (midnight, first of month, ...),
// spaced by the finest step that keeps the count readable.
export const timeAxis = (start: number, end: number): TimeAxis => {
  const span = end - start;
  const [step, unit] =
    TICK_STEPS.find(([n, u]) => span / (n * UNIT_MILLIS[u]) <= MAX_TICKS) ??
    TICK_STEPS[TICK_STEPS.length - 1];

  const tick = moment(start).startOf(unitStart(unit));
  while (tick.valueOf() < start || alignmentIndex(tick, unit) % step !== 0)
    tick.add(1, unit);

  const ticks: number[] = [];
  for (; tick.valueOf() <= end; tick.add(step, unit))
    ticks.push(tick.valueOf());

  const format = tickFormat(unit, !moment(start).isSame(end, 'day'));

  return {
    ticks: ticks.length > 0 ? ticks : [start],
    format: (epoch: number) => moment(epoch).format(format),
  };
};

// True when the data has more than one point per day, i.e. when the time of
// day of a point carries information.
export const hasIntradayPoints = (epochs: number[]): boolean =>
  epochs.some((e, i) => i > 0 && moment(e).isSame(epochs[i - 1], 'day'));

// "Fr., 06.11.2026" or "Fr., 06.11.2026, 10:15"
export const formatPointDate = (epoch: number, intraday: boolean): string =>
  moment(epoch).format(intraday ? 'dd., L, LT' : 'dd., L');

// Ticks are round numbers, so they only get decimals when they have some.
const tickDigits = (value: number): number => (Number.isInteger(value) ? 0 : 2);

export const currencyTick = (value: number): string =>
  formatCurrency(value, { digits: tickDigits(value) });

// for values that already are percentages, i.e. 12.5 for 12,5 %
export const percentTick = (value: number): string =>
  formatPercent(value / 100, { digits: tickDigits(value), signed: true });

export const numberTick = (value: number): string =>
  formatNumber(value, { digits: tickDigits(value) });

// Round growth factors for a log axis: +100 % and -50 % are equally far from 0 %.
const GROWTH_FACTOR_TICKS = [
  0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 50, 100,
];

export interface GrowthFactorAxis {
  domain: [number, number];
  // undefined lets recharts choose, for ranges too narrow for round factors
  ticks: number[] | undefined;
}

export const growthFactorAxis = (factors: number[]): GrowthFactorAxis => {
  const min = Math.min(...factors, 1) * 0.95;
  const max = Math.max(...factors, 1) * 1.05;
  const ticks = GROWTH_FACTOR_TICKS.filter(t => t >= min && t <= max);

  return { domain: [min, max], ticks: ticks.length >= 3 ? ticks : undefined };
};

// a growth factor of 1.5 is labelled +50 %
export const growthFactorTick = (factor: number): string =>
  formatPercent(factor - 1, { digits: 0, signed: true });
