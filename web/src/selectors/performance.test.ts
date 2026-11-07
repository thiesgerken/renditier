import type { PerformanceKind, PortfolioPerformance } from '../types/api';
import {
  findSelectedPeriod,
  getPeriodDescription,
  getPeriodRange,
  groupPeriods,
  periodKey,
} from './performance';

const period = (kind: PerformanceKind, end: string) =>
  ({
    kind,
    start: { date: '2026-01-01' },
    end: { date: end },
  }) as PortfolioPerformance;

const periods = [
  period('Total', '2026-11-07'),
  period('Today', '2026-11-07'),
  period('MonthToDate', '2026-11-07'),
  period('YearToYear', '2025-12-31'),
  period('MonthToMonth', '2026-10-31'),
];

describe('periodKey', () => {
  it('keys running periods by kind, finished ones by their end', () => {
    expect(periods.map(periodKey)).toEqual([
      'Total',
      'Today',
      'MonthToDate',
      'YearToYear/2025-12-31',
      'MonthToMonth/2026-10-31',
    ]);
  });
});

describe('findSelectedPeriod', () => {
  it('finds the period of a key', () => {
    expect(findSelectedPeriod(periods, 'YearToYear/2025-12-31')).toBe(
      periods[3]
    );
  });

  it('falls back to the whole time for a period that is gone', () => {
    expect(findSelectedPeriod(periods, 'MonthToMonth/2025-09-30')).toBe(
      periods[0]
    );
  });
});

describe('groupPeriods', () => {
  it('groups running periods, years and months, without empty groups', () => {
    expect(groupPeriods(periods).map(g => g.map(periodKey))).toEqual([
      ['Today'],
      ['Total', 'YearToYear/2025-12-31'],
      ['MonthToDate', 'MonthToMonth/2026-10-31'],
    ]);
  });
});

describe('getPeriodDescription', () => {
  it('names finished years and months by their end', () => {
    expect(getPeriodDescription(period('YearToYear', '2025-12-31'))).toBe(
      '2025'
    );
    expect(getPeriodDescription(period('MonthToMonth', '2026-03-31'))).toBe(
      '03/2026'
    );
  });
});

describe('getPeriodRange', () => {
  const from = (start: string) =>
    getPeriodRange({
      ...period('Total', '2026-11-07'),
      start: { date: start },
    } as PortfolioPerformance);

  it('starts on the trading day after the period start', () => {
    // Wednesday
    expect(from('2026-11-03')).toEqual(['2026-11-04', '2026-11-07']);
    // Friday, Saturday and Sunday all lead to Monday
    expect(from('2026-10-30')).toEqual(['2026-11-02', '2026-11-07']);
    expect(from('2026-10-31')).toEqual(['2026-11-02', '2026-11-07']);
    expect(from('2026-11-01')).toEqual(['2026-11-02', '2026-11-07']);
  });
});
