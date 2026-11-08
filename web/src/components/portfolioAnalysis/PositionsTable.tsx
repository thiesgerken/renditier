import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
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
import CompanyLogo from '../CompanyLogo';
import ProgressCard from '../ProgressCard';
import { Badge } from '../ui/badge';
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
  const { t } = useTranslation();
  const positions =
    period === undefined
      ? []
      : map(period.positions, (p, isin) => ({ ...p, isin }))
          .filter(p => p.end.units !== 0)
          .sort((a, b) => a.end.invested - b.end.invested);

  return (
    <ProgressCard loading={loading}>
      {/* From md up, the dashboard's section heading names the card. */}
      <CardHeader className="md:hidden">
        <CardTitle>{t('dashboard.tabs.positions')}</CardTitle>
      </CardHeader>
      <div className="px-2 max-sm:px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="hidden xl:table-cell">ISIN</TableHead>
              <TableHead>{t('common.name')}</TableHead>
              <ColumnHead column="units" className="hidden sm:table-cell" />
              <ColumnHead column="price" className="hidden sm:table-cell" />
              <ColumnHead column="invested" className="hidden sm:table-cell" />
              <ColumnHead column="value" />
              <ColumnHead column="profit" />
              <ColumnHead column="irr" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {positions.map(p => {
              const stock = findStock(stocks, p.isin);

              return (
                <TableRow key={p.isin}>
                  <TableCell className="hidden xl:table-cell">
                    {p.isin}
                  </TableCell>
                  <TableCell className="min-w-32 whitespace-normal sm:min-w-40">
                    <div className="flex items-center gap-2">
                      <Link
                        to={`/stocks/${p.isin}`}
                        className="flex items-center gap-2 font-medium text-primary hover:underline"
                      >
                        <CompanyLogo
                          isin={p.isin}
                          name={stock?.title ?? p.isin}
                        />
                        <span className="line-clamp-3 sm:line-clamp-2">
                          {stock === null
                            ? p.isin
                            : capitalizeTitle(stock.title)}
                        </span>
                      </Link>
                      {/* no room on a phone */}
                      {stock !== null && (
                        <Badge
                          variant="secondary"
                          className="hidden shrink-0 sm:inline-flex"
                        >
                          {stock.kind}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <UnitsCell period={p} className="hidden sm:table-cell" />
                  <PriceCell period={p} className="hidden sm:table-cell" />
                  <InvestedCell period={p} className="hidden sm:table-cell" />
                  <ValueCell period={p} />
                  <ProfitCell period={p} />
                  <IrrCell period={p} />
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
