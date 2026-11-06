import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { Tooltip } from '@mui/material';

import type { PortfolioPerformance } from '../../types/api';
import { getPeriodDescription } from '../../selectors/performance';
import Hidden from '../Hidden';
import useTableFormat from '../useTableFormat';
import { formatChange } from '../../format';

interface Props {
  data: PortfolioPerformance;
}

const PerformanceRow = ({ data }: Props) => {
  const { money, irr, signColor } = useTableFormat();

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
        style={signColor(
          // `value` is `number | null`; `?? 0` reproduces the coercion the
          // original relied on when JS added `null` into the sum.
          // FIXME(tsx-migration): the original guarded `data.start === null`,
          // but PortfolioPerformance.start is never null (see types/api), so
          // that branch was dead — dropped rather than kept as a false option.
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
      <TableCell align="right" style={signColor(data.irrAnnual)}>
        {irr(data)}
      </TableCell>
    </TableRow>
  );
};

export default PerformanceRow;
