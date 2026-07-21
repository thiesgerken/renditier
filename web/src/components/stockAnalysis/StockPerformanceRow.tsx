import type { CSSProperties } from 'react';

import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { useMediaQuery, Tooltip } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import moment from 'moment';

import { getPeriodDescription } from '../../selectors/performance';
import Hidden from '../Hidden';
import type {
  DataSource,
  EitherPrice,
  PerformanceKind,
  PositionPerformance,
} from '../../types/api';

// containers/StockAnalysis builds one of these per period by spreading a single
// position's performance next to the enclosing portfolio period's `kind`.
export type StockPerformancePeriod = PositionPerformance & {
  kind: PerformanceKind;
};

interface Props {
  data: StockPerformancePeriod;
}

// `fmt` overrides for fromTo/fromToPercentage take the same shape as formatAmount.
type AmountFormatter = (value: number | null, unit?: string) => string;

const StockPerformanceRow = ({ data }: Props) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));
  const colorize = (v: number | null): CSSProperties =>
    v === null || Math.abs(v) < 5e-3
      ? {}
      : {
          color:
            v < 0 ? theme.palette.secondary.dark : theme.palette.primary.dark,
        };

  const formatAmount = (value: number | null, unit?: string): string =>
    value === null
      ? '\u2014'
      : `${value.toFixed(xsDown ? 0 : 2)}${unit === undefined ? '€' : unit}`;

  const formatPercentage = (value: number | null): string =>
    value === null
      ? ''
      : `${value >= 0 ? '+' : ''}${(value * 100).toFixed(xsDown ? 1 : 2)}%`;

  const chooseIrr = (x: StockPerformancePeriod): string => {
    if (moment(x.end.date).diff(moment(x.start.date), 'days') < 32) {
      if (x.irrPeriod === null) return '';

      return formatPercentage(x.irrPeriod);
    }

    return x.irrAnnual === null ? '' : `${formatPercentage(x.irrAnnual)} p.a.`;
  };

  const fromTo = (
    v1: number | null,
    v2: number | null,
    showDifference?: boolean,
    unit?: string,
    fmt?: AmountFormatter
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

  const fromToPercentage = (
    v1: number | null,
    v2: number | null,
    showDifference?: boolean,
    unit?: string,
    fmt?: AmountFormatter
  ): string => {
    const formatter = fmt === undefined ? formatAmount : fmt;

    if (v1 === 0.0) return formatter(v2, unit);

    let arr = '→';
    if (v1 !== null && v2 !== null && v2 !== v1) arr = v2 > v1 ? '↗' : '↘';

    let s = `${formatter(v1)} ${arr} ${formatter(v2, unit)}`;

    if (showDifference && v1 !== null && v2 !== null && v2 !== v1 && v1 !== 0)
      s += ` (${formatPercentage((v2 - v1) / v1)})`;

    return s;
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

  const formatDataSource = (
    dataSource: DataSource<EitherPrice> | null
  ): string => {
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
    dsStart: DataSource<EitherPrice> | null,
    dsEnd: DataSource<EitherPrice> | null
  ) => (
    <>
      {formatDataSource(dsStart)}
      {dsStart !== null && dsEnd !== null && <br />}
      {formatDataSource(dsEnd)}
    </>
  );

  let priceDiff: number | null = null;
  const priceStart = getPrice(data.start.dataSource);
  const priceEnd = getPrice(data.end.dataSource);
  if (priceStart !== null && priceEnd !== null)
    priceDiff = priceEnd - priceStart;

  const formatUnits = (value: number | null): string => {
    if (value === null) return '\u2014';

    return value.toFixed(xsDown ? 0 : 2);
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
      <TableCell>{getPeriodDescription(data)}</TableCell>
      <TableCell align="right" style={colorize(priceDiff)}>
        <Tooltip
          title={getPriceTooltip(data.start.dataSource, data.end.dataSource)}
          arrow
        >
          <span>
            {fromToPercentage(
              getPrice(data.start.dataSource),
              getPrice(data.end.dataSource),
              true
            )}
          </span>
        </Tooltip>
      </TableCell>
      <Hidden lgDown>
        <TableCell align="right">
          {fromTo(data.start.units, data.end.units, true, '', formatUnits)}
        </TableCell>
      </Hidden>
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
        // `?? 0` reproduces the original arithmetic: a null `value` was coerced
        // to 0 by the surrounding `+` / `-`. `data.start` is never null (see
        // PositionPerformance), so the original ternary guarding it was dead.
        style={colorize(
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
      <Hidden xsDown>
        <TableCell align="right" style={colorize(data.irrAnnual)}>
          {chooseIrr(data)}
        </TableCell>
      </Hidden>
    </TableRow>
  );
};

export default StockPerformanceRow;
