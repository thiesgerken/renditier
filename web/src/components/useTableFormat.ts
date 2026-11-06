import type { CSSProperties } from 'react';
import { useMediaQuery } from '@mui/material';
import { useTheme } from '@mui/material/styles';

import { formatCurrency, formatIrr, formatNumber } from '../format';
import type { Formatter } from '../format';

// Below this, a value is rounding noise rather than a gain or loss.
const EPSILON = 1e-6;

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

  const irr = (period: Parameters<typeof formatIrr>[0]) =>
    formatIrr(period, xsDown ? 1 : 2);

  // gains in the primary, losses in the secondary color
  const signColor = (value: number | null | undefined): CSSProperties =>
    value === null || value === undefined || Math.abs(value) < EPSILON
      ? {}
      : {
          color:
            value < 0
              ? theme.palette.secondary.dark
              : theme.palette.primary.dark,
        };

  return { money, units, irr, signColor, percentDigits: xsDown ? 1 : 2 };
};

export default useTableFormat;
