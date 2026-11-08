import i18n, { formatLocale } from './i18n';
import { getPrice } from './selectors/performance';
import type { DataSource, EitherPrice } from './types/api';

const MISSING = '\u2014';

export interface NumberOptions {
  // number of fraction digits
  digits?: number;
  // allows up to this many fraction digits instead of exactly `digits`
  maxDigits?: number;
  // allows more fraction digits than `maxDigits` where a value needs them for
  // this many significant digits
  significantDigits?: number;
  // show a plus sign for positive values
  signed?: boolean;
}

// Intl.NumberFormat instances are expensive to create and tables format
// hundreds of cells, so they are shared per locale and configuration.
const numberFormats = new Map<string, Intl.NumberFormat>();

const numberFormat = (
  style: 'decimal' | 'currency' | 'percent',
  {
    digits = 2,
    maxDigits = digits,
    significantDigits,
    signed = false,
  }: NumberOptions
): Intl.NumberFormat => {
  const locale = formatLocale();
  const key = `${locale}/${style}/${digits}/${maxDigits}/${significantDigits}/${signed}`;
  let format = numberFormats.get(key);

  if (format === undefined) {
    format = new Intl.NumberFormat(locale, {
      style,
      currency: style === 'currency' ? 'EUR' : undefined,
      minimumFractionDigits: digits,
      maximumFractionDigits: maxDigits,
      ...(significantDigits !== undefined && {
        maximumSignificantDigits: significantDigits,
        roundingPriority: 'morePrecision',
      }),
      signDisplay: signed ? 'exceptZero' : 'auto',
    });
    numberFormats.set(key, format);
  }

  return format;
};

// 12.345,67 €
export const formatCurrency = (
  value: number | null,
  options: NumberOptions = {}
): string =>
  value === null ? MISSING : numberFormat('currency', options).format(value);

// From here on, compact amounts have fewer digits than the whole euros.
const COMPACT_FROM = 10_000;

const compactFormats = new Map<string, Intl.NumberFormat>();

const compactFormat = (signed: boolean): Intl.NumberFormat => {
  const locale = formatLocale();
  const key = `${locale}/${signed}`;
  let format = compactFormats.get(key);

  if (format === undefined) {
    format = new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'EUR',
      notation: 'compact',
      maximumSignificantDigits: 3,
      signDisplay: signed ? 'exceptZero' : 'auto',
    });
    compactFormats.set(key, format);
  }

  return format;
};

// Amounts for where a full one does not fit (phones): below ten thousand as
// formatCurrency has them, from there with three significant digits, 12,3k €
// and 1,23 Mio. € (€12.3K and €1.23M in English). German compact notation
// leaves thousands as they are (12.346 €), so for such a locale the "k" is
// set by hand, behind the number and before the currency.
export const formatCurrencyCompact = (
  value: number | null,
  options: NumberOptions = {}
): string => {
  if (value === null || Math.abs(value) < COMPACT_FROM)
    return formatCurrency(value, options);

  const signed = options.signed ?? false;
  const compact = compactFormat(signed);
  // up to 999,5k; above, the number would round to "1000k"
  const thousandsByHand =
    Math.abs(value) < 999_500 &&
    !compact.formatToParts(COMPACT_FROM).some(p => p.type === 'compact');
  if (!thousandsByHand) return compact.format(value);

  const parts = numberFormat('currency', {
    digits: 0,
    significantDigits: 3,
    signed,
  }).formatToParts(value / 1000);
  const end =
    parts.findLastIndex(p => p.type === 'integer' || p.type === 'fraction') + 1;
  return [...parts.slice(0, end), { value: 'k' }, ...parts.slice(end)]
    .map(p => p.value)
    .join('');
};

// 0.1234 -> 12,34 %
export const formatPercent = (
  ratio: number | null,
  options: NumberOptions = {}
): string =>
  ratio === null ? MISSING : numberFormat('percent', options).format(ratio);

// 1.234,56
export const formatNumber = (
  value: number | null,
  options: NumberOptions = {}
): string =>
  value === null ? MISSING : numberFormat('decimal', options).format(value);

// The separators of formatNumber, for number inputs: "," and "." in German.
// A locale that does not group digits has no group separator.
export const numberSeparators = (): { decimal: string; group: string } => {
  const parts = numberFormat('decimal', {}).formatToParts(1234567.8);
  const separator = (type: 'decimal' | 'group') =>
    parts.find(p => p.type === type)?.value ?? '';

  return { decimal: separator('decimal'), group: separator('group') };
};

// Units are whole for most stocks, but often a small fraction of a single coin
// for crypto currencies, which would round to nothing at `maxDigits`. So they
// keep three significant digits by default: 0,0123 instead of 0,01.
export const formatUnits = (
  value: number | null,
  options: NumberOptions = {}
): string =>
  formatNumber(value, { digits: 0, significantDigits: 3, ...options });

// The API sends days ("2026-11-06") and instants ("2026-11-06T18:30:00Z") as
// ISO strings. Instants are shown in the browser's time zone.
export type DateInput = string | Temporal.PlainDate | Temporal.Instant;

const toTemporal = (date: DateInput) => {
  if (typeof date !== 'string') return date;
  return date.includes('T')
    ? Temporal.Instant.from(date)
    : Temporal.PlainDate.from(date);
};

export const formatTemporal = (
  date: DateInput,
  options: Intl.DateTimeFormatOptions
): string => toTemporal(date).toLocaleString(formatLocale(), options);

const DATE = { day: '2-digit', month: '2-digit', year: 'numeric' } as const;
const TIME = { hour: '2-digit', minute: '2-digit' } as const;

// 06.11.2026
export const formatDate = (date: DateInput): string =>
  formatTemporal(date, DATE);

// 19:30
export const formatTime = (date: DateInput): string =>
  formatTemporal(date, TIME);

// 06.11.2026, 19:30
export const formatDateTime = (date: DateInput): string =>
  formatTemporal(date, { ...DATE, ...TIME });

const UNITS = [
  'years',
  'months',
  'days',
  'hours',
  'minutes',
  'seconds',
] as const;

// "vor 3 Tagen": the largest unit the time span reaches.
export const formatSince = (
  instant: Temporal.Instant,
  now: Temporal.ZonedDateTime
): string => {
  const since = now.since(instant.toZonedDateTimeISO(now.timeZoneId), {
    largestUnit: 'years',
  });
  const unit = UNITS.find(u => since[u] !== 0) ?? 'seconds';

  return new Intl.RelativeTimeFormat(formatLocale()).format(-since[unit], unit);
};

export type Formatter = (
  value: number | null,
  options?: NumberOptions
) => string;

// The change from `start` to `end`, formatted like the values themselves or,
// with `relative`, as a ratio of the start value. "—" when the start is
// unknown, so that it does not pass for "unchanged". null when there is
// nothing to show: the end is unknown (and shown as such already), the period
// started from nothing (e.g. before the first purchase), or the change rounds
// to zero as displayed.
export const formatChange = (
  start: number | null,
  end: number | null,
  format: Formatter,
  relative?: Formatter
): string | null => {
  if (end === null || start === 0) return null;
  if (start === null) return MISSING;

  const shown =
    relative === undefined
      ? format(end - start, { signed: true })
      : relative((end - start) / start, { signed: true });
  const zero = (relative ?? format)(0, { signed: true });

  return shown === zero ? null : shown;
};

export interface IrrPeriod {
  start: { date: string };
  end: { date: string };
  irrAnnual: number | null;
  irrPeriod: number | null;
}

// An annualized rate is misleading for periods shorter than about a month.
export const isShortPeriod = (period: Pick<IrrPeriod, 'start' | 'end'>) =>
  Temporal.PlainDate.from(period.end.date)
    .since(Temporal.PlainDate.from(period.start.date))
    .total('days') < 32;

// Short periods show the rate of the period itself.
export const formatIrr = (period: IrrPeriod, digits = 2): string => {
  const options = { digits, signed: true };

  if (isShortPeriod(period))
    return period.irrPeriod === null
      ? ''
      : formatPercent(period.irrPeriod, options);

  return period.irrAnnual === null
    ? ''
    : `${formatPercent(period.irrAnnual, options)} p.a.`;
};

// "127,00 € am 06.11.2026, 20:40 (Xetra)"; historical prices are daily, so
// they carry no time.
export const formatPriceSource = (
  dataSource: DataSource<EitherPrice> | null
): string => {
  if (dataSource === null) return '';

  const { price, exchange } = dataSource;
  const when =
    price.type === 'RealtimePrice'
      ? formatDateTime(price.date)
      : formatDate(price.date);

  return i18n.t('performance.priceSource', {
    price: formatCurrency(getPrice(dataSource)),
    date: when,
    exchange: exchange.name,
  });
};
