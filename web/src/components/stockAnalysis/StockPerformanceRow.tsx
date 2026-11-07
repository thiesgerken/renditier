import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';

import { getPeriodDescription } from '../../selectors/performance';
import Hidden from '../Hidden';
import useTableFormat from '../useTableFormat';
import {
  InvestedCell,
  PriceCell,
  ProfitCell,
  UnitsCell,
  ValueCell,
} from '../PerformanceCells';
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
  const { irr, ratioColor } = useTableFormat();

  return (
    <TableRow>
      <TableCell>{getPeriodDescription(data)}</TableCell>
      <PriceCell period={data} />
      <Hidden lgDown>
        <UnitsCell period={data} />
      </Hidden>
      <Hidden xsDown>
        <InvestedCell period={data} />
      </Hidden>
      <ValueCell period={data} />
      <ProfitCell period={data} />
      <Hidden xsDown>
        <TableCell
          align="right"
          style={{ whiteSpace: 'nowrap', ...ratioColor(data.irrAnnual) }}
        >
          {irr(data)}
        </TableCell>
      </Hidden>
    </TableRow>
  );
};

export default StockPerformanceRow;
