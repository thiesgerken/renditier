import i18n from './i18n';
import {
  formatChange,
  formatCurrency,
  formatCurrencyCompact,
  formatDate,
  formatDateTime,
  formatTime,
  formatIrr,
  formatNumber,
  formatPercent,
  formatSince,
  formatUnits,
} from './format';

// Intl separates number and unit with a no-break space, written as _ here.
const nbsp = (s: string) => s.replace(/_/g, '\u00a0');

describe('number formatting', () => {
  it('formats euros the German way', () => {
    expect(formatCurrency(12345.678)).toBe(nbsp('12.345,68_€'));
    expect(formatCurrency(-3, { digits: 0 })).toBe(nbsp('-3_€'));
    expect(formatCurrency(5, { signed: true })).toBe(nbsp('+5,00_€'));
    expect(formatCurrency(null)).toBe('—');
  });

  it('abbreviates large euro amounts', () => {
    expect(formatCurrencyCompact(9876.54, { digits: 0 })).toBe(nbsp('9.877_€'));
    expect(formatCurrencyCompact(12345.67)).toBe(nbsp('12,3k_€'));
    expect(formatCurrencyCompact(-123456, { signed: true })).toBe(
      nbsp('-123k_€')
    );
    expect(formatCurrencyCompact(12000, { signed: true })).toBe(nbsp('+12k_€'));
    expect(formatCurrencyCompact(999_700)).toBe(nbsp('1_Mio._€'));
    expect(formatCurrencyCompact(1_234_567)).toBe(nbsp('1,23_Mio._€'));
    expect(formatCurrencyCompact(null)).toBe('—');
  });

  it('abbreviates large euro amounts in English', async () => {
    await i18n.changeLanguage('en');
    try {
      expect(formatCurrencyCompact(12345.67)).toBe('€12.3K');
      expect(formatCurrencyCompact(1_234_567, { signed: true })).toBe(
        '+€1.23M'
      );
    } finally {
      await i18n.changeLanguage('de');
    }
  });

  it('formats ratios as percentages', () => {
    expect(formatPercent(0.1234)).toBe(nbsp('12,34_%'));
    expect(formatPercent(0.05, { signed: true, digits: 1 })).toBe(
      nbsp('+5,0_%')
    );
    expect(formatPercent(0, { signed: true })).toBe(nbsp('0,00_%'));
  });

  it('formats plain numbers', () => {
    expect(formatNumber(1234.5)).toBe('1.234,50');
    expect(formatNumber(-2, { digits: 0, signed: true })).toBe('-2');
    expect(formatNumber(0.123456, { digits: 0, maxDigits: 6 })).toBe(
      '0,123456'
    );
    expect(formatNumber(3, { digits: 0, maxDigits: 6 })).toBe('3');
    expect(
      formatNumber(0.0123, { digits: 0, maxDigits: 2, significantDigits: 3 })
    ).toBe('0,0123');
  });

  it('keeps three significant digits of units', () => {
    expect(formatUnits(0.0123, { maxDigits: 2 })).toBe('0,0123');
    expect(formatUnits(12.345, { maxDigits: 2 })).toBe('12,35');
    expect(formatUnits(12.345, { maxDigits: 0 })).toBe('12,3');
    expect(formatUnits(1234, { maxDigits: 2 })).toBe('1.234');
    expect(formatUnits(1.5, { maxDigits: 2 })).toBe('1,5');
    expect(formatUnits(-0.0123, { maxDigits: 2, signed: true })).toBe(
      '-0,0123'
    );
    expect(formatUnits(null)).toBe('—');
  });

  it('keeps only the first significant digit of units where room is short', () => {
    const phone = { maxDigits: 0, significantDigits: 1 };
    expect(formatUnits(0.0123, phone)).toBe('0,01');
    expect(formatUnits(12.345, phone)).toBe('12');
    expect(formatUnits(1234, phone)).toBe('1.234');
  });
});

describe('date formatting', () => {
  // 19:30 in whatever time zone the tests run in
  const evening = Temporal.PlainDateTime.from('2026-11-06T19:30')
    .toZonedDateTime(Temporal.Now.timeZoneId())
    .toInstant();

  it('uses German dates and 24h times', () => {
    expect(formatDate(evening)).toBe('06.11.2026');
    expect(formatDateTime(evening)).toBe('06.11.2026, 19:30');
    expect(formatTime(evening)).toBe('19:30');
  });

  it("reads the API's days and instants", () => {
    expect(formatDate('2026-11-06')).toBe('06.11.2026');
    expect(formatDateTime(evening.toString())).toBe('06.11.2026, 19:30');
  });
});

describe('formatChange', () => {
  const euros = (v: number | null, o?: { signed?: boolean }) =>
    formatCurrency(v, o);
  const wholeEuros = (v: number | null, o?: { signed?: boolean }) =>
    formatCurrency(v, { digits: 0, ...o });
  const percent = (v: number | null, o?: { signed?: boolean }) =>
    formatPercent(v, o);

  it('shows the difference, or the ratio to the start', () => {
    expect(formatChange(10, 8, euros)).toBe(nbsp('-2,00_€'));
    expect(formatChange(10, 12, euros, percent)).toBe(nbsp('+20,00_%'));
  });

  it('marks an unknown start as missing', () => {
    expect(formatChange(null, 12, euros)).toBe('\u2014');
  });

  it('shows nothing for an unknown end or a start from nothing', () => {
    expect(formatChange(10, null, euros)).toBeNull();
    expect(formatChange(0, 12, euros)).toBeNull();
  });

  it('decides on the change as shown, not on the shown values', () => {
    // both prices show as "5 €", the change does not round away
    expect(formatChange(5.2, 5.4, wholeEuros, percent)).toBe(nbsp('+3,85_%'));
    // the prices show apart, the difference rounds to "0 €"
    expect(formatChange(12.4, 12.6, wholeEuros)).toBeNull();
    expect(formatChange(100, 100.001, euros, percent)).toBeNull();
  });
});

describe('formatIrr', () => {
  const period = (start: string, end: string) => ({
    start: { date: start },
    end: { date: end },
    irrAnnual: 0.1,
    irrPeriod: 0.01,
  });

  it('shows the rate of short periods themselves', () => {
    expect(formatIrr(period('2026-11-05', '2026-11-06'))).toBe(nbsp('+1,00_%'));
  });

  it('annualizes longer periods', () => {
    expect(formatIrr(period('2025-12-31', '2026-11-06'))).toBe(
      nbsp('+10,00_% p.a.')
    );
  });
});

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
