import type { CSSProperties } from 'react';
import TableCell from '@mui/material/TableCell';
import { Box, Tooltip, Typography } from '@mui/material';

import type { PortfolioSnapshot, PositionSnapshot } from '../types/api';
import { getPrice } from '../selectors/performance';
import { formatChange, formatPriceSource } from '../format';
import useTableFormat from './useTableFormat';

// The cells that the performance tables of the portfolio, its positions and a
// single stock share: the value at the end of the period, and its change over
// the period below it.

interface Period {
  start: PortfolioSnapshot;
  end: PortfolioSnapshot;
}

interface PositionPeriod {
  start: PositionSnapshot;
  end: PositionSnapshot;
}

interface ValueWithChangeProps {
  value: string;
  // see formatChange; nothing is shown below the value when it is null
  change: string | null;
  // e.g. signColor for a gain or loss; without it, the change is neutral
  // because its direction is neither good nor bad (more units, more invested)
  changeStyle?: CSSProperties;
}

// A table value with its change over the period below it, smaller. Neither
// line wraps, so that a cell never takes more than these two lines.
const ValueWithChange = ({
  value,
  change,
  changeStyle,
}: ValueWithChangeProps) => (
  <Box sx={{ whiteSpace: 'nowrap' }}>
    {value}
    {change !== null && (
      <Typography
        variant="caption"
        component="div"
        sx={{ color: 'text.secondary' }}
        style={changeStyle}
      >
        {change}
      </Typography>
    )}
  </Box>
);

const difference = (start: number | null, end: number | null) =>
  start === null || end === null ? null : end - start;

export const PriceCell = ({ period }: { period: PositionPeriod }) => {
  const { money, percent, signColor } = useTableFormat();
  const start = getPrice(period.start.dataSource);
  const end = getPrice(period.end.dataSource);

  const sources = (
    <>
      {formatPriceSource(period.start.dataSource)}
      {period.start.dataSource !== null && period.end.dataSource !== null && (
        <br />
      )}
      {formatPriceSource(period.end.dataSource)}
    </>
  );

  return (
    <TableCell align="right">
      <Tooltip title={sources} arrow>
        <div>
          <ValueWithChange
            value={money(end)}
            change={formatChange(start, end, money, percent)}
            changeStyle={signColor(difference(start, end))}
          />
        </div>
      </Tooltip>
    </TableCell>
  );
};

export const UnitsCell = ({ period }: { period: PositionPeriod }) => {
  const { units } = useTableFormat();

  return (
    <TableCell align="right">
      <ValueWithChange
        value={units(period.end.units)}
        change={formatChange(period.start.units, period.end.units, units)}
      />
    </TableCell>
  );
};

export const InvestedCell = ({ period }: { period: Period }) => {
  const { money } = useTableFormat();
  const { start, end } = period;

  const line = (label: string, startValue: number, endValue: number) => {
    const change = formatChange(startValue, endValue, money);
    return `${label}: ${money(endValue)}${change === null ? '' : ` (${change})`}`;
  };

  const feesInfo = (
    <>
      {line('davon Gebühren', -start.fees, -end.fees)}
      <br />
      {line(
        'ohne Gebühren',
        -start.invested + start.fees,
        -end.invested + end.fees
      )}
    </>
  );

  return (
    <TableCell align="right">
      <Tooltip title={feesInfo}>
        <div>
          <ValueWithChange
            value={money(-end.invested)}
            change={formatChange(-start.invested, -end.invested, money)}
          />
        </div>
      </Tooltip>
    </TableCell>
  );
};

// The change of the value includes what was invested or taken out, so it is
// no gain or loss and stays neutral.
export const ValueCell = ({ period }: { period: Period }) => {
  const { money } = useTableFormat();

  return (
    <TableCell align="right">
      <ValueWithChange
        value={money(period.end.value)}
        change={formatChange(period.start.value, period.end.value, money)}
      />
    </TableCell>
  );
};

const profit = (snapshot: PortfolioSnapshot) =>
  snapshot.value === null ? null : snapshot.value + snapshot.invested;

export const ProfitCell = ({ period }: { period: Period }) => {
  const { money, signColor } = useTableFormat();
  const start = profit(period.start);
  const end = profit(period.end);

  return (
    <TableCell align="right" style={signColor(end)}>
      <ValueWithChange
        value={money(end)}
        change={formatChange(start, end, money)}
        changeStyle={signColor(difference(start, end))}
      />
    </TableCell>
  );
};
