import {
  formatCurrency,
  formatPercent,
  formatTemporal,
  formatUnits,
} from '../../format';

type TickUnit = 'hour' | 'day' | 'week' | 'month' | 'year';

const UNIT_MILLIS: Record<TickUnit, number> = {
  hour: 3600e3,
  day: 86400e3,
  week: 7 * 86400e3,
  month: 30.44 * 86400e3,
  year: 365.25 * 86400e3,
};

// Candidate tick spacings, finest first.
const COARSEST_STEP: [number, TickUnit] = [5, 'year'];

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
  COARSEST_STEP,
];

// Upper bound only: recharts drops further ticks when their labels would
// overlap on narrow screens.
const MAX_TICKS = 12;

// Ticks and days are those of the browser's time zone.
const zoned = (epoch: number): Temporal.ZonedDateTime =>
  Temporal.Instant.fromEpochMilliseconds(epoch).toZonedDateTimeISO(
    Temporal.Now.timeZoneId()
  );

const unitStart = (
  t: Temporal.ZonedDateTime,
  unit: TickUnit
): Temporal.ZonedDateTime => {
  switch (unit) {
    case 'hour':
      return t.round({ smallestUnit: 'hour', roundingMode: 'floor' });
    case 'day':
      return t.startOfDay();
    case 'week':
      return t.subtract({ days: t.dayOfWeek - 1 }).startOfDay();
    case 'month':
      return t.with({ day: 1 }).startOfDay();
    default:
      return t.with({ month: 1, day: 1 }).startOfDay();
  }
};

const addUnits = (t: Temporal.ZonedDateTime, n: number, unit: TickUnit) =>
  t.add({ [`${unit}s`]: n });

// Position of a tick within its parent period, to align e.g. every third month
// to quarters. Days and weeks have no natural grid to align to.
const alignmentIndex = (t: Temporal.ZonedDateTime, unit: TickUnit): number => {
  switch (unit) {
    case 'hour':
      return t.hour;
    case 'month':
      return t.month - 1;
    case 'year':
      return t.year;
    default:
      return 0;
  }
};

const TIME = { hour: '2-digit', minute: '2-digit' } as const;
const DATE = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;

const tickFormat = (
  unit: TickUnit,
  spansDays: boolean
): Intl.DateTimeFormatOptions => {
  switch (unit) {
    case 'hour':
      // "Fr., 10:00" or "10:00"
      return spansDays ? { weekday: 'short', ...TIME } : TIME;
    case 'day':
    case 'week':
      // "06.11."
      return { day: '2-digit', month: '2-digit' };
    case 'month':
      // "Nov. 2026"
      return { month: 'short', year: 'numeric' };
    default:
      return { year: 'numeric' };
  }
};

const formatEpoch = (epoch: number, options: Intl.DateTimeFormatOptions) =>
  formatTemporal(Temporal.Instant.fromEpochMilliseconds(epoch), options);

const sameDay = (a: number, b: number): boolean =>
  zoned(a).toPlainDate().equals(zoned(b).toPlainDate());

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
    COARSEST_STEP;

  let tick = unitStart(zoned(start), unit);
  while (
    tick.epochMilliseconds < start ||
    alignmentIndex(tick, unit) % step !== 0
  )
    tick = addUnits(tick, 1, unit);

  const ticks: number[] = [];
  for (; tick.epochMilliseconds <= end; tick = addUnits(tick, step, unit))
    ticks.push(tick.epochMilliseconds);

  const format = tickFormat(unit, !sameDay(start, end));

  return {
    ticks: ticks.length > 0 ? ticks : [start],
    format: (epoch: number) => formatEpoch(epoch, format),
  };
};

// True when the data has more than one point per day, i.e. when the time of
// day of a point carries information.
export const hasIntradayPoints = (epochs: number[]): boolean =>
  epochs.some((e, i) => {
    const previous = epochs[i - 1];
    return previous !== undefined && sameDay(e, previous);
  });

// "Fr., 06.11.2026" or "Fr., 06.11.2026, 10:15"
export const formatPointDate = (epoch: number, intraday: boolean): string =>
  formatEpoch(
    epoch,
    intraday
      ? { weekday: 'short', ...DATE, ...TIME }
      : { weekday: 'short', ...DATE }
  );

// Ticks are round numbers, so they only get decimals when they have some.
const tickDigits = (value: number): number => (Number.isInteger(value) ? 0 : 2);

export const currencyTick = (value: number): string =>
  formatCurrency(value, { digits: tickDigits(value) });

// Plot data holds relative changes in percent, i.e. 12.5 for +12,5 %.
export const percentTick = (value: number): string =>
  formatPercent(value / 100, { digits: tickDigits(value), signed: true });

export const formatPlotPercent = (value: number | null): string =>
  formatPercent(value === null ? null : value / 100, { signed: true });

// "12.345,67 € (+12,34 %)", or just the amount when the change is unknown
export const formatAmountWithChange = (
  amount: number | null,
  percent: number | null
): string =>
  percent === null
    ? formatCurrency(amount)
    : `${formatCurrency(amount)} (${formatPlotPercent(percent)})`;

export const unitsTick = (value: number): string =>
  formatUnits(value, { maxDigits: tickDigits(value) });

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
