import moment from 'moment';
import type { MomentInput } from 'moment';

import { getPrice } from './selectors/performance';
import type { DataSource, EitherPrice } from './types/api';

const LOCALE = 'de-DE';
const MISSING = '\u2014';

export interface NumberOptions {
  // number of fraction digits
  digits?: number;
  // allows up to this many fraction digits instead of exactly `digits`
  maxDigits?: number;
  // show a plus sign for positive values
  signed?: boolean;
}

// Intl.NumberFormat instances are expensive to create and tables format
// hundreds of cells, so they are shared per configuration.
const numberFormats = new Map<string, Intl.NumberFormat>();

const numberFormat = (
  style: 'decimal' | 'currency' | 'percent',
  { digits = 2, maxDigits = digits, signed = false }: NumberOptions
): Intl.NumberFormat => {
  const key = `${style}/${digits}/${maxDigits}/${signed}`;
  let format = numberFormats.get(key);

  if (format === undefined) {
    format = new Intl.NumberFormat(LOCALE, {
      style,
      currency: style === 'currency' ? 'EUR' : undefined,
      minimumFractionDigits: digits,
      maximumFractionDigits: maxDigits,
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

// 06.11.2026
export const formatDate = (date: MomentInput): string =>
  moment(date).format('L');

// 19:30
export const formatTime = (date: MomentInput): string =>
  moment(date).format('LT');

// 06.11.2026, 19:30
export const formatDateTime = (date: MomentInput): string =>
  moment(date).format('L, LT');

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
  moment(period.end.date).diff(moment(period.start.date), 'days') < 32;

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

  return `${formatCurrency(getPrice(dataSource))} am ${when} (${exchange.name})`;
};
