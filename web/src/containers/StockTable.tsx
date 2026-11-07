import { useCallback, useEffect, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import { Briefcase, ChartLine, Hash, Shapes, Target } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { cn } from 'cn';

import CompanyLogo from '../components/CompanyLogo';
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
import i18n from '../i18n';
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
import type { ResourceState } from '../types/store';
import useQueryParam from '../useQueryParam';

type StockRow = Stock & { returns: StockReturns | null };

// Also before the first request, which only starts after the first render:
// otherwise the table would show its empty text until then.
const loading = (resource: ResourceState<unknown>) =>
  resource.isFetching || resource.lastRequest === null;

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

// Headers are functions, so that they are translated when rendered.
const columns = column.columns([
  // Phones need the room for the name and today's change.
  column.accessor('isin', {
    header: 'ISIN',
    meta: { icon: Hash, showFrom: 'sm' },
  }),
  column.accessor('title', {
    header: () => i18n.t('common.name'),
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
    header: () => i18n.t('stocks.columns.kind'),
    meta: { icon: Shapes },
    cell: ({ getValue }) => <Badge variant="secondary">{getValue()}</Badge>,
  }),
  column.accessor('focus', {
    header: () => i18n.t('stocks.columns.focus'),
    meta: { icon: Target, showFrom: 'sm' },
  }),
  column.accessor('fondsType', {
    header: () => i18n.t('stocks.columns.fondsType'),
    meta: { showFrom: 'xl' },
  }),
  column.accessor('company', {
    header: () => i18n.t('stocks.columns.company'),
    meta: { icon: Briefcase, showFrom: 'xl' },
  }),
  column.accessor(row => row.returns?.today ?? null, {
    id: 'today',
    header: () => i18n.t('stocks.columns.today'),
    cell: ({ getValue }) => <ReturnCell ratio={getValue()} />,
  }),
  column.accessor(row => row.returns?.month ?? null, {
    id: 'month',
    header: () => i18n.t('stocks.columns.month'),
    meta: { showFrom: 'md' },
    cell: ({ getValue }) => <ReturnCell ratio={getValue()} />,
  }),
  column.accessor(row => row.returns?.year ?? null, {
    id: 'year',
    header: () => i18n.t('stocks.columns.year'),
    meta: { showFrom: 'md' },
    cell: ({ getValue }) => <ReturnCell ratio={getValue()} />,
  }),
]);

const StockTable = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const stocks = useAppSelector(state => state.stocks);
  const performance = useAppSelector(state => state.performance);
  const stockReturns = useAppSelector(state => state.stockReturns);
  // Only the held stocks unless `?all=1`, so that the default URL stays clean.
  const [allParam, setAll] = useQueryParam('all', { replace: true });
  const onlyHeld = allParam !== '1';
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
    void dispatch(fetchStocks());
    void dispatch(fetchPerformance());
    // Apart from the stocks: it takes a while, and the list shows without it.
    void dispatch(fetchStockReturns());
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
          <CardTitle>{t('nav.stocks')}</CardTitle>
          <CardAction className="flex items-center gap-2">
            <Switch
              id="stocks-only-held"
              checked={onlyHeld}
              onCheckedChange={checked => setAll(checked ? null : 1)}
            />
            <Label htmlFor="stocks-only-held">{t('stocks.heldOnly')}</Label>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataTable
            data={rows}
            columns={columns}
            getRowId={stock => stock.isin}
            initialSorting={[]}
            isLoading={loading(stocks) || (onlyHeld && loading(performance))}
            emptyText={onlyHeld ? t('stocks.noneHeld') : t('stocks.none')}
            onRowClick={stock => {
              void navigate(`/stocks/${stock.isin}`);
            }}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default StockTable;
