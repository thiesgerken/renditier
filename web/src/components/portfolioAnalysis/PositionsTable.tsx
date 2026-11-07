import { Link } from 'react-router-dom';
import { ChartLine } from 'lucide-react';
import { map } from 'lodash';

import type { PortfolioPerformance } from '../../types/api';
import type { StocksState } from '../../types/store';
import { capitalizeTitle, findStock } from '../../selectors/stocks';
import {
  ColumnHead,
  InvestedCell,
  IrrCell,
  PriceCell,
  ProfitCell,
  UnitsCell,
  ValueCell,
} from '../PerformanceCells';
import OnvistaButton from '../OnvistaButton';
import ProgressCard from '../ProgressCard';
import { CardHeader, CardTitle } from '../ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';

interface Props {
  period: PortfolioPerformance | undefined;
  loading: boolean;
  stocks: StocksState;
}

// The positions held at the end of the period, largest investment first.
const PositionsTable = ({ period, loading, stocks }: Props) => {
  const positions =
    period === undefined
      ? []
      : map(period.positions, (p, isin) => ({ ...p, isin }))
          .filter(p => p.end.units !== 0)
          .sort((a, b) => a.end.invested - b.end.invested);

  return (
    <ProgressCard loading={loading}>
      <CardHeader>
        <CardTitle>Positionen</CardTitle>
      </CardHeader>
      <div className="px-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden lg:table-cell">ISIN</TableHead>
              <TableHead>Name</TableHead>
              <ColumnHead column="units" className="hidden sm:table-cell" />
              <ColumnHead column="price" className="hidden sm:table-cell" />
              <ColumnHead column="invested" className="hidden sm:table-cell" />
              <ColumnHead column="value" />
              <ColumnHead column="profit" />
              <ColumnHead column="irr" />
              <TableHead className="hidden lg:table-cell" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map(p => {
              const stock = findStock(stocks, p.isin);

              return (
                <TableRow key={p.isin}>
                  <TableCell className="hidden lg:table-cell">
                    {p.isin}
                  </TableCell>
                  <TableCell className="min-w-32 whitespace-normal sm:min-w-40">
                    <Link
                      to={`/stocks/${p.isin}`}
                      className="flex items-center gap-2 font-medium text-primary hover:underline"
                    >
                      <ChartLine className="size-4 shrink-0" />
                      <span className="line-clamp-3 sm:line-clamp-2">
                        {stock === null ? p.isin : capitalizeTitle(stock.title)}
                      </span>
                    </Link>
                  </TableCell>
                  <UnitsCell period={p} className="hidden sm:table-cell" />
                  <PriceCell period={p} className="hidden sm:table-cell" />
                  <InvestedCell period={p} className="hidden sm:table-cell" />
                  <ValueCell period={p} />
                  <ProfitCell period={p} />
                  <IrrCell period={p} />
                  <TableCell className="hidden text-center lg:table-cell">
                    {stock !== null && (
                      <OnvistaButton relativeUrl={stock.onvistaUrl} />
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </ProgressCard>
  );
};

export default PositionsTable;
