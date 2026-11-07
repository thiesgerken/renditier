import { formatSince } from './Settings';

const now = Temporal.ZonedDateTime.from(
  '2026-03-30T12:00:00+02:00[Europe/Berlin]'
);
const ago = (iso: string) => formatSince(Temporal.Instant.from(iso), now);

describe('formatSince', () => {
  it('names the largest unit the span reaches', () => {
    expect(ago('2026-03-27T09:00:00Z')).toBe('vor 3 Tagen');
    expect(ago('2026-03-30T09:30:00Z')).toBe('vor 30 Minuten');
  });

  it('counts whole units instead of naming calendar days or years', () => {
    // 1 day 23 hours: the day before yesterday, so not "gestern"
    expect(ago('2026-03-28T12:00:00Z')).toBe('vor 1 Tag');
    // 1 year 11 months: two calendar years back, so not "letztes Jahr"
    expect(ago('2024-05-01T00:00:00Z')).toBe('vor 1 Jahr');
  });
});
