import type { CSSProperties } from 'react';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { formatCurrency, formatIrr, formatNumber } from '../format';
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

  const irr = (period: Parameters<typeof formatIrr>[0]) =>
    formatIrr(period, percentDigits);

  // Gains in the primary, losses in the secondary color. Values that are
  // displayed as zero at `shownDigits` fraction digits stay neutral.
  const signColor = (
    value: number | null | undefined,
    shownDigits = digits
  ): CSSProperties =>
    value === null ||
    value === undefined ||
    Math.abs(value) < 0.5 * 10 ** -shownDigits
      ? {}
      : {
          color:
            value < 0
              ? theme.palette.secondary.dark
              : theme.palette.primary.dark,
        };

  // IRRs are ratios, shown as percentages
  const irrColor = (ratio: number | null) =>
    signColor(ratio, percentDigits + 2);

  return { money, units, irr, signColor, irrColor, percentDigits };
};

export default useTableFormat;
