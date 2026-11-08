import type { CSSProperties } from 'react';

import {
  formatCurrency,
  formatCurrencyCompact,
  formatIrr,
  formatPercent,
  formatUnits,
} from '../format';
import type { Formatter } from '../format';
import useMediaQuery, { PHONE } from '../useMediaQuery';

export type Tone = 'gain' | 'loss' | null;

// Number formatting for table cells. Phones only have room for whole euros,
// abbreviated from ten thousand on (12,3k €), units, one decimal of
// percentages and IRRs without "p.a." (ColumnHead puts it in the header
// there); a fraction of a single unit (a crypto position) still shows its
// first significant digit instead of 0.
const useTableFormat = () => {
  const xsDown = useMediaQuery(PHONE);
  const digits = xsDown ? 0 : 2;

  const money: Formatter = (value, options) =>
    xsDown
      ? formatCurrencyCompact(value, { digits, ...options })
      : formatCurrency(value, { digits, ...options });

  // the exact amount, for the title of one that `money` rounds or abbreviates
  const exactMoney = (value: number | null) =>
    xsDown ? formatCurrency(value) : undefined;

  const units: Formatter = (value, options) =>
    formatUnits(value, {
      maxDigits: digits,
      significantDigits: xsDown ? 1 : 3,
      ...options,
    });

  const percentDigits = xsDown ? 1 : 2;

  const percent: Formatter = (ratio, options) =>
    formatPercent(ratio, { digits: percentDigits, ...options });

  const irr = (period: Parameters<typeof formatIrr>[0]) =>
    formatIrr(period, percentDigits, xsDown);

  // Whether a value is a gain or a loss; values that are displayed as zero at
  // `shownDigits` fraction digits are neither.
  const signTone = (
    value: number | null | undefined,
    shownDigits = digits
  ): Tone => {
    if (value === null || value === undefined) return null;
    if (Math.abs(value) < 0.5 * 10 ** -shownDigits) return null;
    return value < 0 ? 'loss' : 'gain';
  };

  // the color token of signTone, for inline styles
  const signColor = (
    value: number | null | undefined,
    shownDigits = digits
  ): CSSProperties => {
    const tone = signTone(value, shownDigits);
    return tone === null ? {} : { color: `var(--${tone})` };
  };

  // for ratios shown as percentages, e.g. IRRs and relative changes
  const ratioTone = (ratio: number | null) =>
    signTone(ratio, percentDigits + 2);

  return {
    money,
    exactMoney,
    units,
    percent,
    irr,
    signTone,
    signColor,
    ratioTone,
  };
};

export default useTableFormat;
