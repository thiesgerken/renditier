import type { CSSProperties } from 'react';

import {
  formatCurrency,
  formatIrr,
  formatPercent,
  formatUnits,
} from '../format';
import type { Formatter } from '../format';
import useMediaQuery, { PHONE } from '../useMediaQuery';

export type Tone = 'gain' | 'loss' | null;

// Number formatting for table cells. Phones only have room for whole euros and
// units (unless that rounds away their significant digits, see formatUnits)
// and one decimal of percentages.
const useTableFormat = () => {
  const xsDown = useMediaQuery(PHONE);
  const digits = xsDown ? 0 : 2;

  const money: Formatter = (value, options) =>
    formatCurrency(value, { digits, ...options });

  const units: Formatter = (value, options) =>
    formatUnits(value, { maxDigits: digits, ...options });

  const percentDigits = xsDown ? 1 : 2;

  const percent: Formatter = (ratio, options) =>
    formatPercent(ratio, { digits: percentDigits, ...options });

  const irr = (period: Parameters<typeof formatIrr>[0]) =>
    formatIrr(period, percentDigits);

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

  return { money, units, percent, irr, signTone, signColor, ratioTone };
};

export default useTableFormat;
