import { createColumnHelper } from '@tanstack/react-table';
import {
  CalendarDays,
  ChartCandlestick,
  Euro,
  Hash,
  Wallet,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import DataTable, { dataTableFeatures } from '../DataTable';
import { KindIcon, kindOf } from '../TransactionKind';
import useTableFormat from '../useTableFormat';
import { getPrice } from '../../selectors/performance';
import { formatDate, formatDateTime } from '../../format';
import type { DataSource, EitherPrice, Transaction } from '../../types/api';

const NONE = '—';

const Units = ({ units }: { units: number }) => {
  const format = useTableFormat();
  return units === 0 ? (
    NONE
  ) : (
    <span style={format.signColor(units)}>
      {format.units(units, { signed: true })}
    </span>
  );
};

// what was paid per unit, without the fees
const Price = ({ amount, units }: Transaction) => {
  const { money } = useTableFormat();
  return units === 0 ? NONE : money(-amount / 100 / units);
};

const Amount = ({ amount, fees }: Transaction) => {
  const { money, signColor } = useTableFormat();
  const total = (amount + fees) / 100;
  return (
    <span
      style={signColor(total)}
      title={
        fees === 0 ? undefined : `enthält Gebühren von ${money(-fees / 100)}`
      }
    >
      {money(total)}
    </span>
  );
};

// What the units of a buy or sell would be worth at today's price, and how
// that compares to what was paid or received for them.
const CurrentValue = ({
  transaction: { units, amount, fees },
  price,
}: {
  transaction: Transaction;
  price: number | null;
}) => {
  const { money, percent, signColor } = useTableFormat();
  if (units === 0 || price === null) return NONE;

  const paid = (amount + fees) / 100;
  const value = Math.abs(units) * price;
  const development = paid + value;

  return (
    <span style={signColor(development)}>
      {`${money(value)} (${percent(-development / paid, { signed: true })})`}
    </span>
  );
};

const column = createColumnHelper<typeof dataTableFeatures, Transaction>();

const columnsFor = (price: number | null) =>
  column.columns([
    column.accessor(row => kindOf(row).label, {
      id: 'kind',
      header: 'Art',
      cell: ({ row }) => <KindIcon transaction={row.original} />,
    }),
    column.accessor(row => Temporal.Instant.from(row.date).epochMilliseconds, {
      id: 'date',
      header: 'Datum',
      meta: { icon: CalendarDays },
      cell: ({ row }) => (
        <span title={formatDateTime(row.original.date)}>
          {formatDate(row.original.date)}
        </span>
      ),
    }),
    column.accessor('units', {
      header: 'Einheiten',
      meta: { icon: Hash },
      cell: ({ getValue }) => <Units units={getValue()} />,
    }),
    column.accessor(row => (row.units === 0 ? null : -row.amount / row.units), {
      id: 'price',
      header: 'Kurs',
      meta: { icon: ChartCandlestick, showFrom: 'xl' },
      cell: ({ row }) => <Price {...row.original} />,
    }),
    column.accessor(row => row.amount + row.fees, {
      id: 'amount',
      header: 'Betrag',
      meta: { icon: Euro },
      cell: ({ row }) => <Amount {...row.original} />,
    }),
    column.display({
      id: 'currentValue',
      header: 'Aktueller Wert',
      meta: { icon: Wallet, showFrom: 'sm' },
      cell: ({ row }) => (
        <CurrentValue transaction={row.original} price={price} />
      ),
    }),
  ]);

interface Props {
  transactions: Transaction[];
  currentPrice: DataSource<EitherPrice> | null;
}

// A stock's buys, sells and dividends, newest first; a row opens the
// transaction on the transactions page.
const TransactionsTable = ({ transactions, currentPrice }: Props) => {
  const navigate = useNavigate();
  const price = currentPrice === null ? null : getPrice(currentPrice);

  return (
    <DataTable
      data={transactions}
      columns={columnsFor(price)}
      getRowId={t => String(t.id)}
      initialSorting={[{ id: 'date', desc: true }]}
      // the stock page only renders once everything has loaded
      isLoading={false}
      emptyText="Keine Transaktionen"
      onRowClick={t => navigate(`/transactions?id=${t.id}`)}
    />
  );
};

export default TransactionsTable;
