import React from 'react';
import PropTypes from 'prop-types';

import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import { Hidden, useMediaQuery, Tooltip } from '@material-ui/core';
import { useTheme } from '@material-ui/core/styles';
import * as moment from 'moment';

import { getPeriodDescription } from '../../selectors/performance';

const PerformanceRow = ({ data }) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('xs'));
  const colorize = v =>
    v === null || Math.abs(v) < 5e-3
      ? {}
      : {
          color:
            v < 0 ? theme.palette.secondary.dark : theme.palette.primary.dark,
        };

  const formatAmount = value =>
    value === null ? '\u2014' : `${value.toFixed(xsDown ? 0 : 2)}€`;
  const formatPercentage = value =>
    value === null
      ? ''
      : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(xsDown ? 1 : 2)}%`;

  const chooseIrr = x => {
    if (moment(x.end.date).diff(moment(x.start.date), 'days') < 32) {
      if (x.irrPeriod === null) return '';

      return formatPercentage(x.irrPeriod);
    }

    return x.irrAnnual === null ? '' : `${formatPercentage(x.irrAnnual)} p.a.`;
  };
  const fromTo = (v1, v2, showDifference) => {
    if (v1 === 0.0) return formatAmount(v2);

    let arr = '→';
    if (v1 !== null && v2 !== null && v2 !== v1) arr = v2 > v1 ? '↗' : '↘';

    let s = `${formatAmount(v1)} ${arr} ${formatAmount(v2)}`;

    if (showDifference && v1 !== null && v2 !== null && v2 !== v1 && v1 !== 0)
      s += ` (${v2 >= v1 ? '+' : ''}${formatAmount(v2 - v1)})`;

    return s;
  };

  const feesInfo = (
    <>
      <span>
        {`davon Gebühren: ${fromTo(-1 * data.start.fees, -1 * data.end.fees)}`}
      </span>
      <br />
      <span>
        {`ohne Gebühren: ${fromTo(
          -1 * data.start.invested + data.start.fees,
          -1 * data.end.invested + data.end.fees
        )}`}
      </span>
    </>
  );

  const safeAdd = (x, y) => {
    if (x === null || y === null) return null;
    return x + y;
  };

  return (
    <TableRow>
      <TableCell>{getPeriodDescription(data)}</TableCell>
      <Hidden xsDown>
        <TableCell align="right">
          <Tooltip title={feesInfo}>
            <span>
              {fromTo(-1 * data.start.invested, -1 * data.end.invested)}
            </span>
          </Tooltip>
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
          safeAdd(data.start.value, data.start.invested),
          safeAdd(data.end.value, data.end.invested),
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
    start: PropTypes.shape({
      value: PropTypes.number,
      invested: PropTypes.number,
      fees: PropTypes.number,
      units: PropTypes.number,
      dataSource: PropTypes.shape({}),
    }),
    end: PropTypes.shape({
      value: PropTypes.number,
      invested: PropTypes.number,
      fees: PropTypes.number,
      units: PropTypes.number,
      dataSource: PropTypes.shape({}),
    }),
    irrAnnual: PropTypes.number,
    irrPeriod: PropTypes.number,
  }).isRequired,
};

export default PerformanceRow;
