import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';

import type { PortfolioPerformance } from '../../types/api';
import { getPeriodDescription } from '../../selectors/performance';
import Hidden from '../Hidden';
import useTableFormat from '../useTableFormat';
import { InvestedCell, ProfitCell, ValueCell } from '../PerformanceCells';

interface Props {
  data: PortfolioPerformance;
}

const PerformanceRow = ({ data }: Props) => {
  const { irr, irrColor } = useTableFormat();

  return (
    <TableRow>
      <TableCell>{getPeriodDescription(data)}</TableCell>
      <Hidden xsDown>
        <InvestedCell period={data} />
      </Hidden>
      <ValueCell period={data} />
      <ProfitCell period={data} />
      <TableCell
        align="right"
        style={{ whiteSpace: 'nowrap', ...irrColor(data.irrAnnual) }}
      >
        {irr(data)}
      </TableCell>
    </TableRow>
  );
};

export default PerformanceRow;
