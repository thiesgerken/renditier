import React from 'react';
import PropTypes from 'prop-types';

import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import * as moment from 'moment';
import { useTheme, Hidden } from '@material-ui/core';
import { min, map, max } from 'lodash';

const formatAmount = value => (value === null ? '' : `${value.toFixed(2)}€`);
const formatPercentage = value =>
  value === null ? '' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;

const calculateProfit = end => {
  if (end.value === null) {
    return '\u2014';
  }

  const diff = end.value + end.invested;

  return `${formatAmount(diff)} (${formatPercentage(
    (-1.0 * diff) / end.invested
  )})`;
};

const hideIrr = item => {
  let firstTransaction = min(map(item.transactions, t => moment(t.date)));
  firstTransaction = max([moment(item.start.date), firstTransaction]);

  if (firstTransaction === undefined) return true;
  return moment(item.end.date).diff(firstTransaction, 'days') < 32;
};

const PositionRow = ({ data }) => {
  const theme = useTheme();
  const colorize = v =>
    v === null
      ? {}
      : {
          color:
            v < 0 ? theme.palette.secondary.dark : theme.palette.primary.dark,
        };

  return (
    <TableRow>
      <TableCell>{data.isin}</TableCell>
      <Hidden xsDown>
        <TableCell align="right">{data.end.units.toFixed(3)}</TableCell>
        <TableCell align="right">
          {data.end.dataSource === null
            ? '\u2014'
            : formatAmount(data.end.dataSource.price.price)}
        </TableCell>
        <TableCell align="right">
          {formatAmount(-1 * data.end.invested)}
        </TableCell>
      </Hidden>
      <TableCell align="right">
        {data.end.value === null ? '\u2014' : formatAmount(data.end.value)}
      </TableCell>
      <TableCell
        align="right"
        style={colorize(
          data.end.value +
            data.end.invested -
            (data.start === null ? 0.0 : data.start.value + data.start.invested)
        )}
      >
        {calculateProfit(data.end)}
      </TableCell>
      <TableCell align="right" style={colorize(data.irrAnnual)}>
        {data.irrAnnual === null || hideIrr(data)
          ? ''
          : `${formatPercentage(data.irrAnnual)} p.a.`}
      </TableCell>
    </TableRow>
  );
};

PositionRow.propTypes = {
  data: PropTypes.shape({
    isin: PropTypes.string,
    units: PropTypes.number,
    end: PropTypes.object,
    start: PropTypes.object,
    irrAnnual: PropTypes.number,
  }).isRequired,
};

export default PositionRow;
