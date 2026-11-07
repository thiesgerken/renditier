import { useCallback, useEffect } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Briefcase, ChartLine, Hash, Shapes, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import CompanyLogo from '../components/CompanyLogo';
import DataTable, { dataTableFeatures } from '../components/DataTable';
import StockComparisonPlot from '../components/StockComparisonPlot';
import { Badge } from '../components/ui/badge';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { abbreviateTitle } from '../selectors/stocks';
import { fetchPerformance } from '../slices/performance';
import { updateStockPlot } from '../slices/stockPlot';
import { fetchStocks } from '../slices/stocks';
import { useAppDispatch, useAppSelector } from '../store';
import type { DataSourceSelection, IsoDate, Stock } from '../types/api';

// stable while the stocks load, so that the table keeps its row models
const NO_STOCKS: Stock[] = [];

const column = createColumnHelper<typeof dataTableFeatures, Stock>();

const columns = column.columns([
  column.accessor('isin', {
    header: 'ISIN',
    meta: { icon: Hash },
  }),
  column.accessor('title', {
    header: 'Name',
    meta: { icon: ChartLine },
    cell: ({ row, getValue }) => (
      <span className="flex items-center gap-2 sm:min-w-40">
        <CompanyLogo isin={row.original.isin} name={getValue()} />
        <span className="line-clamp-2 whitespace-normal">
          <span className="sm:hidden">{abbreviateTitle(getValue(), true)}</span>
          <span className="max-sm:hidden">
            {abbreviateTitle(getValue(), false)}
          </span>
        </span>
      </span>
    ),
  }),
  column.accessor('kind', {
    header: 'Typ',
    meta: { icon: Shapes },
    cell: ({ getValue }) => <Badge variant="secondary">{getValue()}</Badge>,
  }),
  column.accessor('focus', {
    header: 'Fokus',
    meta: { icon: Target, showFrom: 'sm' },
  }),
  column.accessor('fondsType', {
    header: 'Fondstyp',
    meta: { showFrom: 'xl' },
  }),
  column.accessor('company', {
    header: 'Anbieter',
    meta: { icon: Briefcase, showFrom: 'xl' },
  }),
]);

const StockTable = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const stocks = useAppSelector(state => state.stocks);
  const performance = useAppSelector(state => state.performance);
  const stockPlotData = useAppSelector(state => state.stockPlot.items);
  const updateStockPlotData = useCallback(
    (
      isin: string | null,
      startDate: IsoDate | null,
      endDate: IsoDate | null,
      source: DataSourceSelection | null
    ) => dispatch(updateStockPlot(isin, startDate, endDate, source)),
    [dispatch]
  );

  useEffect(() => {
    dispatch(fetchStocks());
    dispatch(fetchPerformance());
  });

  return (
    <div className="mx-auto flex max-w-(--breakpoint-xl) flex-col gap-3">
      <div className="max-sm:hidden">
        <StockComparisonPlot
          stocks={stocks}
          data={stockPlotData}
          updateData={updateStockPlotData}
          performance={performance}
        />
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Wertpapiere</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={stocks.data ?? NO_STOCKS}
            columns={columns}
            getRowId={stock => stock.isin}
            initialSorting={[]}
            isLoading={stocks.isFetching}
            emptyText="Noch keine Wertpapiere"
            onRowClick={stock => navigate(`/stocks/${stock.isin}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default StockTable;
