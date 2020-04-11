import React from 'react';
import PropTypes from 'prop-types';

import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import * as moment from 'moment';
import { useTheme, Hidden, useMediaQuery, Tooltip } from '@material-ui/core';

const TransactionRow = ({ transaction, currentPrice }) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('xs'));

  const colorize = v =>
    v === null || v === undefined || Math.abs(v) < 5e-3
      ? {}
      : {
          color:
            v < 0 ? theme.palette.secondary.dark : theme.palette.primary.dark,
        };

  const formatPercentage = value =>
    value === null
      ? ''
      : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(xsDown ? 1 : 2)}%`;

  const formatAmount = (value, unit) =>
    value === null
      ? '\u2014'
      : `${value.toFixed(xsDown ? 0 : 2)}${unit === undefined ? '€' : unit}`;

  const formatUnits = value => {
    if (value === null || value === 0) return '\u2014';

    return `${value >= 0 ? '+' : ''}${value.toFixed(xsDown ? 0 : 2)}`;
  };

  const getPrice = dataSource => {
    if (dataSource === null) return null;

    if (dataSource.price.price !== undefined) return dataSource.price.price;
    return dataSource.price.closing;
  };

  let currentValueInfo = '\u2014';
  let valueDevelopment;
  if (currentPrice !== null && transaction.units !== 0) {
    const currentValue = Math.abs(transaction.units) * getPrice(currentPrice);

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

TransactionRow.propTypes = {
  transaction: PropTypes.shape({
    date: PropTypes.string,
    units: PropTypes.number,
    fees: PropTypes.number,
    amount: PropTypes.number,
  }).isRequired,
  currentPrice: PropTypes.shape({}),
};

TransactionRow.defaultProps = { currentPrice: null };

export default TransactionRow;
