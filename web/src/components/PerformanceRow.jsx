import React from 'react';
import PropTypes from 'prop-types';

import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import * as moment from 'moment';
import { useTheme } from '@material-ui/core/styles';
import { getPeriodDescription } from '../selectors/performance';
import { Hidden } from '@material-ui/core';

const formatAmount = value =>
  value === null ? '\u2014' : `${value.toFixed(2)}€`;
const formatPercentage = value =>
  value === null ? '' : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(2)}%`;

const chooseIrr = data => {
  if (moment(data.end.date).diff(moment(data.start.date), 'days') < 32) {
    return data.irrPeriod === null ? '' : formatPercentage(data.irrPeriod);
  }

  return data.irrAnnual === null
    ? ''
    : `${formatPercentage(data.irrAnnual)} p.a.`;
};

const PerformanceRow = ({ data }) => {
  const theme = useTheme();
  const colorize = v =>
    v === null
      ? {}
      : {
          color:
            v < 0 ? theme.palette.secondary.dark : theme.palette.primary.dark,
        };

  const fromTo = (v1, v2, showDifference) => {
    let arr = '→';
    if (v1 !== null && v2 !== null && v2 !== v1) arr = v2 > v1 ? '↗' : '↘';

    let s = `${formatAmount(v1)} ${arr} ${formatAmount(v2)}`;

    if (showDifference && v1 !== null && v2 !== null && v2 !== v1 && v1 !== 0)
      s += ` (${v2 >= v1 ? '+' : ''}${formatAmount(v2 - v1)})`;

    return s;
  };

  return (
    <TableRow>
      <TableCell>{getPeriodDescription(data)}</TableCell>
      <Hidden xsDown>
        <TableCell align="right">
          {fromTo(-1 * data.start.invested, -1 * data.end.invested)}
        </TableCell>
      </Hidden>
      <TableCell align="right">
        {fromTo(data.start.value, data.end.value)}
      </TableCell>
      <TableCell
        align="right"
        style={colorize(
          data.end.value +
            data.end.invested -
            (data.start === null ? 0.0 : data.start.value + data.start.invested)
        )}
      >
        {fromTo(
          data.start.value + data.start.invested,
          data.end.value + data.end.invested,
          true
        )}
      </TableCell>
      <TableCell align="right" style={colorize(data.irrAnnual)}>
        {chooseIrr(data)}
      </TableCell>
    </TableRow>
  );
};

PerformanceRow.propTypes = {
  data: PropTypes.shape({
    kind: PropTypes.string,
    start: PropTypes.object,
    end: PropTypes.object,
    irrAnnual: PropTypes.number,
    irrPeriod: PropTypes.number,
  }).isRequired,
};

export default PerformanceRow;
