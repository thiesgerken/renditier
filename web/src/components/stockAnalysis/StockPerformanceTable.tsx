import { Fragment } from 'react';

import type { PerformanceKind, PositionPerformance } from '../../types/api';
import type { ResourceState } from '../../types/store';
import {
  getPeriodDescription,
  groupPeriods,
  periodKey,
} from '../../selectors/performance';
import {
  ColumnHead,
  InvestedCell,
  IrrCell,
  PriceCell,
  ProfitCell,
  UnitsCell,
  ValueCell,
} from '../PerformanceCells';
import ProgressCard from '../ProgressCard';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '../ui/table';

// containers/StockAnalysis builds one of these per period by spreading a single
// position's performance next to the enclosing portfolio period's `kind`.
export type StockPerformancePeriod = PositionPerformance & {
  kind: PerformanceKind;
};

interface Props {
  // The performance slice, with its portfolio-wide periods replaced by the
  // single position's periods (see containers/StockAnalysis).
  performance: ResourceState<StockPerformancePeriod[]>;
}

const StockPerformanceTable = ({ performance }: Props) => (
  <ProgressCard loading={performance.isFetching} className="px-2">
    <Table>
      <TableHeader>
        <TableRow>
          <ColumnHead column="period" />
          <ColumnHead column="price" />
          <ColumnHead column="units" className="hidden lg:table-cell" />
          <ColumnHead column="invested" className="hidden sm:table-cell" />
          <ColumnHead column="value" />
          <ColumnHead column="profit" />
          <ColumnHead column="irr" className="hidden sm:table-cell" />
        </TableRow>
      </TableHeader>
      <TableBody>
        {groupPeriods(performance.data ?? []).map((group, i) => (
          <Fragment key={group[0].kind}>
            {i > 0 && (
              <TableRow aria-hidden className="h-6 hover:bg-transparent" />
            )}
            {group.map(p => (
              <TableRow key={periodKey(p)}>
                <TableCell>{getPeriodDescription(p)}</TableCell>
                <PriceCell period={p} />
                <UnitsCell period={p} className="hidden lg:table-cell" />
                <InvestedCell period={p} className="hidden sm:table-cell" />
                <ValueCell period={p} />
                <ProfitCell period={p} />
                <IrrCell period={p} className="hidden sm:table-cell" />
              </TableRow>
            ))}
          </Fragment>
        ))}
      </TableBody>
    </Table>
  </ProgressCard>
);

export default StockPerformanceTable;
