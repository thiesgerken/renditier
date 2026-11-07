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
import { useSchemePalette } from '../muiTheme';

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

  const palette = useSchemePalette();

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
          color: value < 0 ? palette.secondary.dark : palette.primary.dark,
        };

  // for ratios shown as percentages, e.g. IRRs and relative changes
  const ratioColor = (ratio: number | null) =>
    signColor(ratio, percentDigits + 2);

  return { money, units, percent, irr, signColor, ratioColor };
};

export default useTableFormat;
