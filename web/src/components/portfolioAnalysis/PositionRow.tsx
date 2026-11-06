import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import { useTheme, useMediaQuery, Button, Tooltip } from '@mui/material';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import type { PositionPerformance, Stock } from '../../types/api';
import { getPrice } from '../../selectors/performance';
import { abbreviateTitle } from '../../selectors/stocks';
import { formatChange, formatPriceSource } from '../../format';
import OnvistaButton from '../OnvistaButton';
import Hidden from '../Hidden';
import useTableFormat from '../useTableFormat';

// PositionsTable spreads the ISIN (the key of PortfolioPerformance.positions)
// onto each entry before handing it over.
type PositionRowData = PositionPerformance & { isin: string };

interface Props {
  data: PositionRowData;
  stock?: Stock | null;
  push: (path: string) => void;
}

const PositionRow = ({ data, stock = null, push }: Props) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));

  const { money, units, irr, signColor } = useTableFormat();

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
          {formatChange(data.start.units, data.end.units, units, 'absolute')}
        </TableCell>
      </Hidden>
      <Hidden xsDown>
        <TableCell align="right">
          <Tooltip title={priceTooltip} arrow>
            <span>
              {formatChange(
                getPrice(data.start.dataSource),
                getPrice(data.end.dataSource),
                money
              )}
            </span>
          </Tooltip>
        </TableCell>
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
          // but PositionPerformance.start is never null (see types/api), so
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
      <Hidden lgDown>
        <TableCell align="center">
          {stock && <OnvistaButton relativeUrl={stock.onvistaUrl} />}
        </TableCell>
      </Hidden>
    </TableRow>
  );
};

export default PositionRow;
