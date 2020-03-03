import React from 'react';
import PropTypes from 'prop-types';

import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import * as moment from 'moment';

const formatAmount = value => (value === null ? '' : `${value.toFixed(2)}€`);
const formatPercentage = value =>
  value === null ? '' : `${(value * 100).toFixed(2)}%`;

const calculateProfit = (start, end) => {
  if (end.value === null || (start !== null && start.value === null)) {
    return '\u2014';
  }

  const diff =
    end.value +
    end.invested -
    (start === null ? 0.0 : start.value + start.invested);

  return (
    formatAmount(diff) +
    (start === null || start.value === 0.0
      ? ''
      : ` (${formatPercentage(diff / start.value)})`)
  );
};

const hideIrr = item => {
  if (item.start === null) return false;

  return moment(item.end.date).diff(moment(item.start.date), 'days') < 32;
};

const getDescription = item => {
  switch (item.kind) {
    case 'Total':
      return 'Insgesamt';
    case 'Today':
      return 'Heute';
    case 'WeekToDate':
      return 'Diese Woche';
    case 'MonthToDate':
      return 'Dieser Monat';
    case 'YearToDate':
      return 'Dieses Jahr';
    case 'YearToYear':
      return moment(item.end.date).format('YYYY');
    case 'MonthToMonth':
      return moment(item.end.date).format('MM/YYYY');
    default:
      return '';
  }
};

const PerformanceRow = ({ data }) => (
  <TableRow key={getDescription(data)}>
    <TableCell>{getDescription(data)}</TableCell>
    <TableCell align="right">
      {data.start === null ? '\u2014' : formatAmount(-1 * data.start.invested)}
    </TableCell>
    <TableCell align="right">
      {data.start === null || data.start.value === null
        ? '\u2014'
        : formatAmount(data.start.value)}
    </TableCell>
    <TableCell align="right">{formatAmount(-1 * data.end.invested)}</TableCell>
    <TableCell align="right">
      {data.end.value === null ? '\u2014' : formatAmount(data.end.value)}
    </TableCell>
    <TableCell align="right">{calculateProfit(data.start, data.end)}</TableCell>
    <TableCell align="right">
      {data.irr === null || hideIrr(data)
        ? ''
        : `${formatPercentage(data.irr)} p.a.`}
    </TableCell>
  </TableRow>
);

PerformanceRow.propTypes = {
  data: PropTypes.shape({
    kind: PropTypes.string,
    start: PropTypes.object,
    end: PropTypes.object,
    irr: PropTypes.number,
  }).isRequired,
};

export default PerformanceRow;
