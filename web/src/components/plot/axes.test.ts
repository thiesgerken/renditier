import {
  formatPointDate,
  growthFactorAxis,
  hasIntradayPoints,
  timeAxis,
} from './axes';

// local time, like the plots
const at = (s: string) =>
  Temporal.PlainDateTime.from(s).toZonedDateTime(Temporal.Now.timeZoneId())
    .epochMilliseconds;
const labels = (start: string, end: string) => {
  const axis = timeAxis(at(start), at(end));
  return axis.ticks.map(axis.format);
};

describe('timeAxis', () => {
  it('uses years for long ranges', () => {
    expect(labels('2019-01-23', '2026-11-06')).toEqual([
      '2020',
      '2021',
      '2022',
      '2023',
      '2024',
      '2025',
      '2026',
    ]);
  });

  it('uses months aligned to the calendar for about a year', () => {
    expect(labels('2026-01-02', '2026-11-06')).toEqual([
      'Feb. 2026',
      'März 2026',
      'Apr. 2026',
      'Mai 2026',
      'Juni 2026',
      'Juli 2026',
      'Aug. 2026',
      'Sept. 2026',
      'Okt. 2026',
      'Nov. 2026',
    ]);
  });

  it('uses days for a month', () => {
    const l = labels('2026-10-01T18:00', '2026-10-30T18:00');
    expect(l[0]).toBe('05.10.');
    expect(l).toContain('26.10.');
  });

  it('uses hours within a day', () => {
    expect(labels('2026-11-06T09:00', '2026-11-06T18:00')).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '13:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
      '18:00',
    ]);
  });

  it('never places ticks outside the data', () => {
    const start = at('2026-03-15T18:00');
    const end = at('2026-09-20T18:00');
    const { ticks } = timeAxis(start, end);
    expect(ticks.every(t => t >= start && t <= end)).toBe(true);
  });
});

describe('formatPointDate', () => {
  it('names the weekday, and the time for intraday data', () => {
    expect(formatPointDate(at('2026-11-06T10:15'), false)).toBe(
      'Fr., 06.11.2026'
    );
    expect(formatPointDate(at('2026-11-06T10:15'), true)).toBe(
      'Fr., 06.11.2026, 10:15'
    );
  });
});

describe('hasIntradayPoints', () => {
  it('detects several points on one day', () => {
    expect(
      hasIntradayPoints([at('2026-11-06T09:00'), at('2026-11-06T09:05')])
    ).toBe(true);
    expect(
      hasIntradayPoints([at('2026-11-05T18:00'), at('2026-11-06T18:00')])
    ).toBe(false);
  });
});

describe('growthFactorAxis', () => {
  it('uses round factors that cover the data', () => {
    const { domain, ticks } = growthFactorAxis([0.8, 1.2, 6.5]);
    expect(domain[0]).toBeLessThan(0.8);
    expect(domain[1]).toBeGreaterThan(6.5);
    expect(ticks).toEqual([1, 1.5, 2, 3, 5]);
  });

  it('leaves narrow ranges to recharts', () => {
    expect(growthFactorAxis([0.99, 1.02]).ticks).toBeUndefined();
  });
});
