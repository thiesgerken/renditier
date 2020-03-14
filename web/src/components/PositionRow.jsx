import React from 'react';
import PropTypes from 'prop-types';

import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import * as moment from 'moment';

const formatAmount = value => (value === null ? '' : `${value.toFixed(2)}€`);
const formatPercentage = value =>
  value === null ? '' : `${(value * 100).toFixed(2)}%`;

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
  if (item.start === null) return false;

  return moment(item.end.date).diff(moment(item.start.date), 'days') < 32;
};

const PositionRow = ({ data }) => (
  <TableRow>
    <TableCell>{data.isin}</TableCell>
    <TableCell align="right">{data.end.units.toFixed(3)}</TableCell>
    <TableCell align="right">
      {data.end.dataSource === null
        ? '\u2014'
        : formatAmount(data.end.dataSource.price.price)}
    </TableCell>
    <TableCell align="right">{formatAmount(-1 * data.end.invested)}</TableCell>
    <TableCell align="right">
      {data.end.value === null ? '\u2014' : formatAmount(data.end.value)}
    </TableCell>
    <TableCell align="right">{calculateProfit(data.end)}</TableCell>
    <TableCell align="right">
      {data.irr === null || hideIrr(data)
        ? ''
        : `${formatPercentage(data.irr)} p.a.`}
    </TableCell>
  </TableRow>
);

PositionRow.propTypes = {
  data: PropTypes.shape({
    isin: PropTypes.string,
    units: PropTypes.number,
    end: PropTypes.object,
    irr: PropTypes.number,
  }).isRequired,
};

export default PositionRow;
