import type { CSSProperties } from 'react';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import {
  formatCurrency,
  formatIrr,
  formatNumber,
  formatPercent,
} from '../format';
import type { Formatter } from '../format';

// Number formatting for table cells. Phones only have room for whole euros and
// units and one decimal of percentages.
const useTableFormat = () => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));
  const digits = xsDown ? 0 : 2;

  const money: Formatter = (value, options) =>
    formatCurrency(value, { digits, ...options });

  const units: Formatter = (value, options) =>
    formatNumber(value, { digits, ...options });

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
  ): 'gain' | 'loss' | null => {
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
  const ratioColor = (ratio: number | null) =>
    signColor(ratio, percentDigits + 2);

  return { money, units, percent, irr, signTone, signColor, ratioColor };
};

export default useTableFormat;
