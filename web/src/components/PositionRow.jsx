import React from 'react';
import PropTypes from 'prop-types';

import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import * as moment from 'moment';
import { useTheme, Hidden, useMediaQuery, Button } from '@material-ui/core';
import ShowChartIcon from '@material-ui/icons/ShowChart';

const PositionRow = ({ data, stock }) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('xs'));

  const colorize = v =>
    v === null || v === 0.0
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
    if (value === null) return '\u2014';

    return value.toFixed(xsDown ? 0 : 2);
    // while (s[s.length - 1] === '0' || s[s.length - 1] === '.')
    //   s = s.substr(0, s.length - 1);
    // return s;
  };

  const getPrice = dataSource => {
    if (dataSource === null) return '\u2014';

    if (dataSource.price.price !== undefined) return dataSource.price.price;
    return dataSource.price.closing;
  };

  const chooseIrr = x => {
    if (moment(x.end.date).diff(moment(x.start.date), 'days') < 32) {
      return x.irrPeriod === null ? '' : formatPercentage(x.irrPeriod);
    }

    return x.irrAnnual === null ? '' : `${formatPercentage(x.irrAnnual)} p.a.`;
  };

  const fromTo = (v1, v2, showDifference, unit, fmt) => {
    const formatter = fmt === undefined ? formatAmount : fmt;

    if (v1 === 0.0) return formatter(v2, unit);

    let arr = '→';
    if (v1 !== null && v2 !== null && v2 !== v1) arr = v2 > v1 ? '↗' : '↘';

    let s = `${formatter(v1)} ${arr} ${formatter(v2, unit)}`;

    if (showDifference && v1 !== null && v2 !== null && v2 !== v1 && v1 !== 0)
      s += ` (${v2 >= v1 ? '+' : ''}${formatter(v2 - v1, unit)})`;

    return s;
  };

  // TODO: add a cell with stock name

  return (
    <TableRow>
      <TableCell style={{ padding: '2px' }}>
        <Button variant="text" color="primary" startIcon={<ShowChartIcon />}>
          {data.isin}
        </Button>
      </TableCell>
      <Hidden xsDown>
        <TableCell>{stock !== null ? stock.title : ''}</TableCell>
      </Hidden>
      <Hidden xsDown>
        <TableCell align="right">
          {fromTo(data.start.units, data.end.units, true, '', formatUnits)}
        </TableCell>
        <TableCell align="right">
          {fromTo(
            getPrice(data.start.dataSource),
            getPrice(data.end.dataSource)
          )}
        </TableCell>
        <TableCell align="right">
          {fromTo(-1 * data.start.invested, -1 * data.end.invested)}
        </TableCell>
      </Hidden>
      <TableCell align="right">
        {' '}
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

PositionRow.propTypes = {
  data: PropTypes.shape({
    isin: PropTypes.string,
    units: PropTypes.number,
    end: PropTypes.object,
    start: PropTypes.object,
    irrAnnual: PropTypes.number,
  }).isRequired,
  stock: PropTypes.shape({
    title: PropTypes.string,
  }),
};

export default PositionRow;
