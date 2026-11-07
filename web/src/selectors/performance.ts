import type {
  DataSource,
  EitherPrice,
  IsoDate,
  PerformanceKind,
  PortfolioPerformance,
  PositionPerformance,
} from '../types/api';

// Called both with a whole-portfolio period and with a single position's
// performance for that period, which containers/StockAnalysis builds by
// spreading the position next to the portfolio period's `kind`.
export type PerformancePeriod =
  PortfolioPerformance | (PositionPerformance & { kind: PerformanceKind });

export const getPeriodDescription = (item: PerformancePeriod): string => {
  switch (item.kind) {
    case 'Total':
      return 'Insgesamt';
    case 'Today':
      return 'Heute';
    case 'WeekToDate':
      return 'Diese Woche';
    case 'MonthToDate':
      return 'Dieser Monat';
    case 'YearToDate':
      return 'Dieses Jahr';
    case 'YearToYear':
      return `${Temporal.PlainDate.from(item.end.date).year}`;
    case 'MonthToMonth': {
      const { month, year } = Temporal.PlainDate.from(item.end.date);
      return `${String(month).padStart(2, '0')}/${year}`;
    }
    default:
      return '';
  }
};

interface Snapshot {
  value: number | null;
  invested: number;
}

// What the holdings of a snapshot are worth beyond what was paid for them;
// null without a price. Sold holdings keep their realized profit or loss.
export const profit = (snapshot: Snapshot): number | null =>
  snapshot.value === null ? null : snapshot.value + snapshot.invested;

// The profit made within a period, as opposed to profit(period.end), which
// is everything made up to its end.
export const periodGain = (period: {
  start: Snapshot;
  end: Snapshot;
}): number | null => {
  const start = profit(period.start);
  const end = profit(period.end);
  return start === null || end === null ? null : end - start;
};

// Identifies a period across reloads of the performance data: the running
// periods exist once each and keep their key from day to day, finished years
// and months are told apart by their end.
export const periodKey = (period: PerformancePeriod): string =>
  period.kind === 'YearToYear' || period.kind === 'MonthToMonth'
    ? `${period.kind}/${period.end.date}`
    : period.kind;

// The running periods, shortest first, with the labels of the period switch.
export const RUNNING_PERIODS: { kind: PerformanceKind; label: string }[] = [
  { kind: 'Today', label: 'Heute' },
  { kind: 'WeekToDate', label: 'Woche' },
  { kind: 'MonthToDate', label: 'Monat' },
  { kind: 'YearToDate', label: 'Jahr' },
  { kind: 'Total', label: 'Insgesamt' },
];

// The selected period, or the whole time if it is gone from the data, e.g. a
// month that dropped out of the last twelve while the app was open.
export const findSelectedPeriod = (
  periods: PortfolioPerformance[],
  key: string
): PortfolioPerformance | undefined =>
  periods.find(p => periodKey(p) === key) ??
  periods.find(p => p.kind === 'Total');

// The row groups of a performance table: running periods, years (with the
// whole time), months; each in the order of the data, empty ones left out.
const PERIOD_GROUPS: PerformanceKind[][] = [
  ['Today', 'WeekToDate'],
  ['Total', 'YearToDate', 'YearToYear'],
  ['MonthToDate', 'MonthToMonth'],
];

export const groupPeriods = <T extends { kind: PerformanceKind }>(
  periods: T[]
): [T, ...T[]][] =>
  PERIOD_GROUPS.map(kinds =>
    periods.filter(p => kinds.includes(p.kind))
  ).filter((group): group is [T, ...T[]] => group.length > 0);

export const getPrice = (
  dataSource: DataSource<EitherPrice> | null
): number | null => {
  if (dataSource === null) return null;

  return dataSource.price.type === 'RealtimePrice'
    ? dataSource.price.price
    : dataSource.price.closing;
};

// dayOfWeek counts from Monday = 1 to Sunday = 7
const nextWeekDay = (date: Temporal.PlainDate): Temporal.PlainDate =>
  date.dayOfWeek > 5 ? date.add({ days: 8 - date.dayOfWeek }) : date;

// The plotted range of a period. A period's start date is the last day before
// it, whose closing prices it compares against, so the plot starts on the next
// trading day.
export const getPeriodRange = (
  period: PortfolioPerformance
): [IsoDate, IsoDate] => [
  nextWeekDay(
    Temporal.PlainDate.from(period.start.date).add({ days: 1 })
  ).toString(),
  period.end.date,
];

// The backend values a position at exactly 0 when its units are exactly 0, so
// any other amount, even a float residue of a sale, is still held.
export const isHeld = (p: PositionPerformance): boolean => p.end.units !== 0;
