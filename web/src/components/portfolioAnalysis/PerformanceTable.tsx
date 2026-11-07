import { Fragment } from 'react';

import type { PortfolioPerformance } from '../../types/api';
import {
  getPeriodDescription,
  groupPeriods,
  periodKey,
} from '../../selectors/performance';
import {
  ColumnHead,
  InvestedCell,
  IrrCell,
  ProfitCell,
  ValueCell,
} from '../PerformanceCells';
import ProgressCard from '../ProgressCard';
import { CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from '../ui/table';

interface Props {
  periods: PortfolioPerformance[];
  loading: boolean;
  // the periodKey of the dashboard's period, whose row is highlighted
  selected: string | null;
}

// Every period side by side, to compare them; the selected one is highlighted.
const PerformanceTable = ({ periods, loading, selected }: Props) => (
  <ProgressCard loading={loading}>
    <CardHeader>
      <CardTitle>Verlauf</CardTitle>
    </CardHeader>
    <div className="px-2">
      <Table>
        <TableHeader>
          <TableRow>
            <ColumnHead column="period" />
            <ColumnHead column="invested" className="hidden sm:table-cell" />
            <ColumnHead column="value" />
            <ColumnHead column="profit" />
            <ColumnHead column="irr" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {groupPeriods(periods).map((group, i) => (
            <Fragment key={group[0].kind}>
              {i > 0 && (
                <TableRow aria-hidden className="h-6 hover:bg-transparent" />
              )}
              {group.map(p => (
                <TableRow
                  key={periodKey(p)}
                  className="data-[state=selected]:bg-primary/10"
                  data-state={
                    periodKey(p) === selected ? 'selected' : undefined
                  }
                >
                  <TableCell>{getPeriodDescription(p)}</TableCell>
                  <InvestedCell period={p} className="hidden sm:table-cell" />
                  <ValueCell period={p} />
                  <ProfitCell period={p} />
                  <IrrCell period={p} />
                </TableRow>
              ))}
            </Fragment>
          ))}
        </TableBody>
      </Table>
    </div>
  </ProgressCard>
);

export default PerformanceTable;
