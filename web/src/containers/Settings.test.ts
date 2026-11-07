import { formatSince } from './Settings';

const now = Temporal.ZonedDateTime.from(
  '2026-03-30T12:00:00+02:00[Europe/Berlin]'
);
const ago = (iso: string) => formatSince(Temporal.Instant.from(iso), now);

describe('formatSince', () => {
  it('names the largest unit the span reaches', () => {
    expect(ago('2026-03-27T09:00:00Z')).toBe('vor 3 Tagen');
    expect(ago('2026-03-30T09:30:00Z')).toBe('vor 30 Minuten');
    expect(ago('2025-01-01T00:00:00Z')).toBe('letztes Jahr');
  });

  it('says "jetzt" for the current moment', () => {
    expect(ago('2026-03-30T10:00:00Z')).toBe('jetzt');
  });
});
