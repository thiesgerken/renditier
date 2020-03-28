import React from 'react';
import PropTypes from 'prop-types';

import TableCell from '@material-ui/core/TableCell';
import TableRow from '@material-ui/core/TableRow';
import * as moment from 'moment';
import {
  useTheme,
  Hidden,
  useMediaQuery,
  Button,
  withStyles,
  Tooltip,
} from '@material-ui/core';
import ShowChartIcon from '@material-ui/icons/ShowChart';
import { abbreviateTitle } from '../selectors/stocks';

const PositionRow = ({ data, stock, push }) => {
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
  };

  const getPrice = dataSource => {
    if (dataSource === null) return '\u2014';

    if (dataSource.price.price !== undefined) return dataSource.price.price;
    return dataSource.price.closing;
  };

  const formatDataSource = dataSource => {
    if (!dataSource) return '';

    if (dataSource.price.type === 'RealtimePrice') {
      return `${formatAmount(dataSource.price.price)} am ${moment(
        dataSource.price.date
      ).format('L LT')} (${dataSource.exchange.name})`;
    }

    return `${formatAmount(dataSource.price.closing)} am ${moment(
      dataSource.price.date
    ).format('L')} (${dataSource.exchange.name})`;
  };

  const getPriceTooltip = (dsStart, dsEnd) => {
    return (
      <>
        {formatDataSource(dsStart)}
        {dsStart !== null && dsEnd !== null && <br />}
        {formatDataSource(dsEnd)}
      </>
    );
  };

  const chooseIrr = x => {
    if (moment(x.end.date).diff(moment(x.start.date), 'days') < 32) {
      return x.irrPeriod === null ? '' : formatPercentage(x.irrPeriod);
    }

    return x.irrAnnual === null ? '' : `${formatPercentage(x.irrAnnual)} p.a.`;
  };

  const StyledButton = withStyles(() => ({
    root: { textTransform: 'none', fontWeight: 600 },
  }))(Button);

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

  return (
    <TableRow>
      <Hidden lgDown>
        <TableCell>{data.isin}</TableCell>
      </Hidden>
      <TableCell
        style={{
          padding: '2px',
        }}
      >
        <Button
          variant="text"
          color="primary"
          startIcon={<ShowChartIcon />}
          onClick={() => push(`/stocks/${data.isin}`)}
        >
          <span
            style={{
              wordWrap: 'break-word',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              // wordBreak: 'break-all',
              WebkitLineClamp: xsDown ? 3 : 2,
              textAlign: 'left',
            }}
          >
            {stock !== null ? abbreviateTitle(stock.title, xsDown) : data.isin}
          </span>
        </Button>
      </TableCell>
      <Hidden lgDown>
        <TableCell align="right">
          {fromTo(data.start.units, data.end.units, true, '', formatUnits)}
        </TableCell>
      </Hidden>
      <Hidden xsDown>
        <TableCell align="right">
          <Tooltip
            title={getPriceTooltip(data.start.dataSource, data.end.dataSource)}
            arrow
          >
            <span>
              {fromTo(
                getPrice(data.start.dataSource),
                getPrice(data.end.dataSource)
              )}
            </span>
          </Tooltip>
        </TableCell>
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
      <Hidden lgDown>
        <TableCell align="center">
          {stock && (
            <Tooltip title="auf onvista.de ansehen" arrow>
              <StyledButton
                color="secondary"
                rel="noreferrer"
                size="small"
                href={`https://www.onvista.de${stock.onvistaUrl}`}
                target="_blank"
              >
                onvista
              </StyledButton>
            </Tooltip>
          )}
        </TableCell>
      </Hidden>
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
    onvistaUrl: PropTypes.string,
  }),
  push: PropTypes.func.isRequired,
};

PositionRow.defaultProps = {
  stock: null,
};

export default PositionRow;
