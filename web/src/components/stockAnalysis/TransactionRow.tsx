import type { CSSProperties } from 'react';

import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import moment from 'moment';
import { useTheme, useMediaQuery, Tooltip } from '@mui/material';

import Hidden from '../Hidden';
import type { DataSource, EitherPrice, Transaction } from '../../types/api';

interface Props {
  transaction: Transaction;
  currentPrice?: DataSource<EitherPrice> | null;
}

const TransactionRow = ({ transaction, currentPrice = null }: Props) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));

  const colorize = (v: number | null | undefined): CSSProperties =>
    v === null || v === undefined || Math.abs(v) < 5e-3
      ? {}
      : {
          color:
            v < 0 ? theme.palette.secondary.dark : theme.palette.primary.dark,
        };

  const formatPercentage = (value: number | null): string =>
    value === null
      ? ''
      : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(xsDown ? 1 : 2)}%`;

  const formatAmount = (value: number | null, unit?: string): string =>
    value === null
      ? '\u2014'
      : `${value.toFixed(xsDown ? 0 : 2)}${unit === undefined ? '€' : unit}`;

  const formatUnits = (value: number | null): string => {
    if (value === null || value === 0) return '\u2014';

    return `${value >= 0 ? '+' : ''}${value.toFixed(xsDown ? 0 : 2)}`;
  };

  const getPrice = (
    dataSource: DataSource<EitherPrice> | null
  ): number | null => {
    if (dataSource === null) return null;

    // The original tested `dataSource.price.price !== undefined`, which is true
    // for exactly the RealtimePrice variant of the tagged EitherPrice union.
    if (dataSource.price.type === 'RealtimePrice')
      return dataSource.price.price;
    return dataSource.price.closing;
  };

  let currentValueInfo = '\u2014';
  let valueDevelopment: number | undefined;
  if (currentPrice !== null && transaction.units !== 0) {
    // `?? 0` reproduces the original multiplication, in which a null price was
    // coerced to 0.
    const currentValue =
      Math.abs(transaction.units) * (getPrice(currentPrice) ?? 0);

    valueDevelopment =
      (transaction.fees + transaction.amount) / 100 + currentValue;
    currentValueInfo = `${formatAmount(currentValue)} (${formatPercentage(
      ((-1 * valueDevelopment) / (transaction.fees + transaction.amount)) * 100
    )})`;
  }

  return (
    <TableRow>
      <TableCell align="left">
        <Tooltip title={moment(transaction.date).format('L [um] LT')} arrow>
          <span>{moment(transaction.date).format('L')}</span>
        </Tooltip>
      </TableCell>
      <TableCell align="right" style={colorize(transaction.units)}>
        {formatUnits(transaction.units)}
      </TableCell>
      <Hidden lgDown>
        <TableCell align="right">
          {transaction.units !== 0
            ? formatAmount((-1 * transaction.amount) / 100 / transaction.units)
            : '\u2014'}
        </TableCell>
      </Hidden>
      <TableCell
        align="right"
        style={colorize(transaction.amount + transaction.fees)}
      >
        <Tooltip
          title={
            transaction.fees !== 0
              ? `enthält Gebühren in Höhe von ${formatAmount(
                  (-1 * transaction.fees) / 100
                )}`
              : ''
          }
          arrow
        >
          <span>
            {formatAmount((transaction.amount + transaction.fees) / 100)}
          </span>
        </Tooltip>
      </TableCell>
      <TableCell align="right" style={colorize(valueDevelopment)}>
        {currentValueInfo}
      </TableCell>
    </TableRow>
  );
};

export default TransactionRow;
