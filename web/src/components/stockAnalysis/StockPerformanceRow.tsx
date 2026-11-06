import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { Tooltip } from '@mui/material';

import { getPeriodDescription, getPrice } from '../../selectors/performance';
import { formatChange, formatPriceSource } from '../../format';
import Hidden from '../Hidden';
import useTableFormat from '../useTableFormat';
import type { PerformanceKind, PositionPerformance } from '../../types/api';

// containers/StockAnalysis builds one of these per period by spreading a single
// position's performance next to the enclosing portfolio period's `kind`.
export type StockPerformancePeriod = PositionPerformance & {
  kind: PerformanceKind;
};

interface Props {
  data: StockPerformancePeriod;
}

const StockPerformanceRow = ({ data }: Props) => {
  const { money, units, irr, signColor } = useTableFormat();

  const priceStart = getPrice(data.start.dataSource);
  const priceEnd = getPrice(data.end.dataSource);
  const priceDiff =
    priceStart !== null && priceEnd !== null ? priceEnd - priceStart : null;

  const priceTooltip = (
    <>
      {formatPriceSource(data.start.dataSource)}
      {data.start.dataSource !== null && data.end.dataSource !== null && <br />}
      {formatPriceSource(data.end.dataSource)}
    </>
  );

  const feesInfo = (
    <>
      <span>
        {`davon Gebühren: ${formatChange(
          -1 * data.start.fees,
          -1 * data.end.fees,
          money
        )}`}
      </span>
      <br />
      <span>
        {`ohne Gebühren: ${formatChange(
          -1 * data.start.invested + data.start.fees,
          -1 * data.end.invested + data.end.fees,
          money
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
      <TableCell align="right" style={signColor(priceDiff)}>
        <Tooltip title={priceTooltip} arrow>
          <span>{formatChange(priceStart, priceEnd, money, 'relative')}</span>
        </Tooltip>
      </TableCell>
      <Hidden lgDown>
        <TableCell align="right">
          {formatChange(data.start.units, data.end.units, units, 'absolute')}
        </TableCell>
      </Hidden>
      <Hidden xsDown>
        <TableCell align="right">
          <Tooltip title={feesInfo}>
            <span>
              {formatChange(
                -1 * data.start.invested,
                -1 * data.end.invested,
                money
              )}
            </span>
          </Tooltip>
        </TableCell>
      </Hidden>
      <TableCell align="right">
        {formatChange(data.start.value, data.end.value, money)}
      </TableCell>
      <TableCell
        align="right"
        // `?? 0` reproduces the original arithmetic: a null `value` was coerced
        // to 0 by the surrounding `+` / `-`. `data.start` is never null (see
        // PositionPerformance), so the original ternary guarding it was dead.
        style={signColor(
          (data.end.value ?? 0) +
            data.end.invested -
            ((data.start.value ?? 0) + data.start.invested)
        )}
      >
        {formatChange(
          safeAdd(data.start.value, data.start.invested),
          safeAdd(data.end.value, data.end.invested),
          money,
          'absolute'
        )}
      </TableCell>
      <Hidden xsDown>
        <TableCell align="right" style={signColor(data.irrAnnual)}>
          {irr(data)}
        </TableCell>
      </Hidden>
    </TableRow>
  );
};

export default StockPerformanceRow;
