import { findGaps, holdOverGaps } from './gaps';

// local time, like the plots
const at = (s: string) =>
  Temporal.PlainDateTime.from(s).toZonedDateTime(Temporal.Now.timeZoneId())
    .epochMilliseconds;

// every 15 minutes from 09:00 to 17:30 on the given day
const tradingDay = (date: string) =>
  Array.from({ length: 35 }, (_, i) => at(`${date}T09:00`) + i * 15 * 60e3);

describe('findGaps', () => {
  it('finds nights and weekends in intraday data', () => {
    const epochs = ['2026-11-05', '2026-11-06', '2026-11-09'].flatMap(
      tradingDay
    );

    expect(findGaps(epochs)).toEqual([
      { start: at('2026-11-05T17:30'), end: at('2026-11-06T09:00') },
      { start: at('2026-11-06T17:30'), end: at('2026-11-09T09:00') },
    ]);
  });

  it('ignores a few missing samples', () => {
    const epochs = tradingDay('2026-11-06').filter((_, i) => i < 10 || i > 12);

    expect(findGaps(epochs)).toEqual([]);
  });

  it('finds only weekends when there are just openings and closes', () => {
    const epochs = [
      '2026-11-05T09:00',
      '2026-11-05T17:30',
      '2026-11-06T09:00',
      '2026-11-06T17:30',
      '2026-11-09T09:00',
      '2026-11-09T17:30',
    ].map(at);

    expect(findGaps(epochs)).toEqual([
      { start: at('2026-11-06T17:30'), end: at('2026-11-09T09:00') },
    ]);
  });

  it('finds nothing in a single point', () => {
    expect(findGaps([at('2026-11-06T09:00')])).toEqual([]);
  });
});

describe('holdOverGaps', () => {
  const trades = {
    boughtUnits: 1,
    boughtAmount: 100,
    soldUnits: 0,
    soldAmount: 0,
  };
  const points = [
    { epoch: at('2026-11-05T17:15'), value: 1, trades: null },
    { epoch: at('2026-11-05T17:30'), value: 2, trades },
    { epoch: at('2026-11-06T09:00'), value: 3, trades: null },
  ];
  const gap = { start: at('2026-11-05T17:30'), end: at('2026-11-06T09:00') };

  it('holds the last value until just before trading resumes', () => {
    const [first, last, held, next] = holdOverGaps(points, [gap]);

    expect([first, last, next]).toEqual(points);
    expect(held).toEqual({
      epoch: at('2026-11-06T09:00') - 1,
      value: 2,
      trades: null,
      heldFrom: points[1],
    });
  });

  it('leaves points without gaps alone', () => {
    expect(holdOverGaps(points, [])).toEqual(points);
  });
});
