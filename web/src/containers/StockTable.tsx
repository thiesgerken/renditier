import { useCallback, useEffect, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Briefcase, ChartLine, Hash, Shapes, Target } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from 'cn';

import DataTable, { dataTableFeatures } from '../components/DataTable';
import StockComparisonPlot from '../components/StockComparisonPlot';
import { Badge } from '../components/ui/badge';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import useTableFormat from '../components/useTableFormat';
import { abbreviateTitle } from '../selectors/stocks';
import { fetchPerformance } from '../slices/performance';
import { updateStockPlot } from '../slices/stockPlot';
import { fetchStockReturns } from '../slices/stockReturns';
import { fetchStocks } from '../slices/stocks';
import { useAppDispatch, useAppSelector } from '../store';
import type {
  DataSourceSelection,
  IsoDate,
  Stock,
  StockReturns,
} from '../types/api';
import useQueryParam from '../useQueryParam';

type StockRow = Stock & { returns: StockReturns | null };

const ReturnCell = ({ ratio }: { ratio: number | null }) => {
  const { percent, ratioTone } = useTableFormat();
  const tone = ratioTone(ratio);

  return (
    <span
      className={cn(
        'tabular-nums',
        tone === 'gain' && 'text-gain',
        tone === 'loss' && 'text-loss'
      )}
    >
      {percent(ratio, { signed: true })}
    </span>
  );
};

const column = createColumnHelper<typeof dataTableFeatures, StockRow>();

const columns = column.columns([
  // Phones need the room for the name and today's change.
  column.accessor('isin', {
    header: 'ISIN',
    meta: { icon: Hash, showFrom: 'sm' },
  }),
  column.accessor('title', {
    header: 'Name',
    meta: { icon: ChartLine },
    cell: ({ getValue }) => (
      <span className="line-clamp-2 whitespace-normal sm:min-w-40">
        <span className="sm:hidden">{abbreviateTitle(getValue(), true)}</span>
        <span className="max-sm:hidden">
          {abbreviateTitle(getValue(), false)}
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
  column.accessor(row => row.returns?.today ?? null, {
    id: 'today',
    header: 'Heute',
    cell: ({ getValue }) => <ReturnCell ratio={getValue()} />,
  }),
  column.accessor(row => row.returns?.month ?? null, {
    id: 'month',
    header: '1 Monat',
    meta: { showFrom: 'md' },
    cell: ({ getValue }) => <ReturnCell ratio={getValue()} />,
  }),
  column.accessor(row => row.returns?.year ?? null, {
    id: 'year',
    header: '1 Jahr',
    meta: { showFrom: 'md' },
    cell: ({ getValue }) => <ReturnCell ratio={getValue()} />,
  }),
]);

const StockTable = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const stocks = useAppSelector(state => state.stocks);
  const performance = useAppSelector(state => state.performance);
  const stockReturns = useAppSelector(state => state.stockReturns);
  const [heldParam, setHeld] = useQueryParam('held', { replace: true });
  const onlyHeld = heldParam === '1';
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
    // Apart from the stocks: it takes a while, and the list shows without it.
    dispatch(fetchStockReturns());
  });

  // A new array only when the inputs change, so that the table keeps its row
  // models and sorting.
  const rows = useMemo(() => {
    // Held now: the positions of the "Total" period that end with units.
    const held = new Set(
      Object.entries(
        performance.data?.find(p => p.kind === 'Total')?.positions ?? {}
      )
        .filter(([, position]) => position.end.units !== 0)
        .map(([isin]) => isin)
    );

    return (stocks.data ?? [])
      .filter(stock => !onlyHeld || held.has(stock.isin))
      .map(stock => ({
        ...stock,
        returns: stockReturns.data?.[stock.isin] ?? null,
      }));
  }, [stocks.data, performance.data, stockReturns.data, onlyHeld]);

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
          <CardAction className="flex items-center gap-2">
            <Switch
              id="stocks-only-held"
              checked={onlyHeld}
              onCheckedChange={checked => setHeld(checked ? 1 : null)}
            />
            <Label htmlFor="stocks-only-held">Nur gehaltene</Label>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataTable
            data={rows}
            columns={columns}
            getRowId={stock => stock.isin}
            initialSorting={[]}
            isLoading={
              stocks.isFetching || (onlyHeld && performance.isFetching)
            }
            emptyText={
              onlyHeld
                ? 'Keine gehaltenen Wertpapiere'
                : 'Noch keine Wertpapiere'
            }
            onRowClick={stock => navigate(`/stocks/${stock.isin}`)}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default StockTable;
