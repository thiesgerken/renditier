import type { CSSProperties } from 'react';

import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import moment from 'moment';
import { useTheme, useMediaQuery, Button, Tooltip } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import type {
  DataSource,
  EitherPrice,
  PositionPerformance,
  Stock,
} from '../../types/api';
import { abbreviateTitle } from '../../selectors/stocks';
import OnvistaButton from '../OnvistaButton';
import Hidden from '../Hidden';

// PositionsTable spreads the ISIN (the key of PortfolioPerformance.positions)
// onto each entry before handing it over.
type PositionRowData = PositionPerformance & { isin: string };

type PositionDataSource = DataSource<EitherPrice> | null;

interface Props {
  data: PositionRowData;
  stock?: Stock | null;
  push: (path: string) => void;
}

const PositionRow = ({ data, stock = null, push }: Props) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));

  const colorize = (v: number | null): CSSProperties =>
    v === null || v === 0.0
      ? {}
      : {
          color:
            v < 0 ? theme.palette.secondary.dark : theme.palette.primary.dark,
        };

  const formatPercentage = (value: number | null): string =>
    value === null
      ? ''
      : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(xsDown ? 1 : 2)}%`;

  const formatAmount = (
    value: number | null | undefined,
    unit?: string
  ): string =>
    value === null || value === undefined
      ? '\u2014'
      : `${value.toFixed(xsDown ? 0 : 2)}${unit === undefined ? '€' : unit}`;

  const formatUnits = (value: number | null): string => {
    if (value === null) return '\u2014';

    return value.toFixed(xsDown ? 0 : 2);
  };

  const getPrice = (dataSource: PositionDataSource): number | null => {
    if (dataSource === null) return null;

    // `price` only exists on the RealtimePrice variant of EitherPrice, so the
    // original `price !== undefined` test is exactly this discriminant check.
    if (dataSource.price.type === 'RealtimePrice')
      return dataSource.price.price;
    return dataSource.price.closing;
  };

  const formatDataSource = (dataSource: PositionDataSource): string => {
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

  const getPriceTooltip = (
    dsStart: PositionDataSource,
    dsEnd: PositionDataSource
  ) => (
    <>
      {formatDataSource(dsStart)}
      {dsStart !== null && dsEnd !== null && <br />}
      {formatDataSource(dsEnd)}
    </>
  );

  const chooseIrr = (x: PositionRowData): string => {
    if (moment(x.end.date).diff(moment(x.start.date), 'days') < 32) {
      return x.irrPeriod === null ? '' : formatPercentage(x.irrPeriod);
    }

    return x.irrAnnual === null ? '' : `${formatPercentage(x.irrAnnual)} p.a.`;
  };

  const fromTo = (
    v1: number | null,
    v2: number | null,
    showDifference?: boolean,
    unit?: string,
    fmt?: (value: number | null, unit?: string) => string
  ): string => {
    const formatter = fmt === undefined ? formatAmount : fmt;

    if (v1 === 0.0) return formatter(v2, unit);

    let arr = '→';
    if (v1 !== null && v2 !== null && v2 !== v1) arr = v2 > v1 ? '↗' : '↘';

    let s = `${formatter(v1)} ${arr} ${formatter(v2, unit)}`;

    if (showDifference && v1 !== null && v2 !== null && v2 !== v1 && v1 !== 0)
      s += ` (${v2 >= v1 ? '+' : ''}${formatter(v2 - v1, unit)})`;

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

  const safeAdd = (x: number | null, y: number | null): number | null => {
    if (x === null || y === null) return null;
    return x + y;
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
      <Hidden xsDown>
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
          // `value` is `number | null`; `?? 0` reproduces the coercion the
          // original relied on when JS added `null` into the sum.
          // FIXME(tsx-migration): the original guarded `data.start === null`,
          // but PositionPerformance.start is never null (see types/api), so
          // that branch was dead — dropped rather than kept as a false option.
          (data.end.value ?? 0) +
            data.end.invested -
            ((data.start.value ?? 0) + data.start.invested)
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
      <Hidden lgDown>
        <TableCell align="center">
          {stock && <OnvistaButton relativeUrl={stock.onvistaUrl} />}
        </TableCell>
      </Hidden>
    </TableRow>
  );
};

export default PositionRow;
