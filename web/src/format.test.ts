import moment from 'moment';
import 'moment/dist/locale/de';

import {
  formatChange,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatIrr,
  formatNumber,
  formatPercent,
} from './format';

// Intl separates number and unit with a no-break space, written as _ here.
const nbsp = (s: string) => s.replace(/_/g, '\u00a0');

beforeAll(() => {
  moment.locale('de');
});

describe('number formatting', () => {
  it('formats euros the German way', () => {
    expect(formatCurrency(12345.678)).toBe(nbsp('12.345,68_€'));
    expect(formatCurrency(-3, { digits: 0 })).toBe(nbsp('-3_€'));
    expect(formatCurrency(5, { signed: true })).toBe(nbsp('+5,00_€'));
    expect(formatCurrency(null)).toBe('—');
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
  });
});

describe('date formatting', () => {
  it('uses German dates and 24h times', () => {
    const d = moment('2026-11-06T19:30:00');
    expect(formatDate(d)).toBe('06.11.2026');
    expect(formatDateTime(d)).toBe('06.11.2026, 19:30');
  });
});

describe('formatChange', () => {
  const euros = (v: number | null, o?: { signed?: boolean }) =>
    formatCurrency(v, o);

  it('shows start, direction and end', () => {
    expect(formatChange(10, 12, euros)).toBe(nbsp('10,00_€ ↗ 12,00_€'));
    expect(formatChange(12, 12, euros)).toBe(nbsp('12,00_€ → 12,00_€'));
  });

  it('shows only the end when there was nothing at the start', () => {
    expect(formatChange(0, 12, euros, 'absolute')).toBe(nbsp('12,00_€'));
  });

  it('appends absolute or relative differences', () => {
    expect(formatChange(10, 8, euros, 'absolute')).toBe(
      nbsp('10,00_€ ↘ 8,00_€ (-2,00_€)')
    );
    expect(formatChange(10, 12, euros, 'relative')).toBe(
      nbsp('10,00_€ ↗ 12,00_€ (+20,00_%)')
    );
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
