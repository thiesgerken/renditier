import { useEffect, useMemo } from 'react';
import { createColumnHelper } from '@tanstack/react-table';
import {
  Building2,
  CalendarDays,
  ChartLine,
  CircleMinus,
  CirclePlus,
  Euro,
  HandCoins,
  MessageSquare,
  Plus,
  Upload,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';

import DataTable, { dataTableFeatures } from '../components/DataTable';
import useTableFormat from '../components/useTableFormat';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { formatCurrency, formatDate, formatDateTime } from '../format';
import { abbreviateTitle, findStock } from '../selectors/stocks';
import { fetchAccounts } from '../slices/accounts';
import { uploadReceipts } from '../slices/receipts';
import { fetchStocks } from '../slices/stocks';
import { fetchTransactions } from '../slices/transactions';
import { useAppDispatch, useAppSelector } from '../store';
import type { Stock, Transaction } from '../types/api';
import type { StocksState } from '../types/store';
import useQueryParam from '../useQueryParam';
import ReceiptUploadDialog from './ReceiptUploadDialog';
import TransactionDialog from './TransactionDialog';
import type { TransactionDraft } from './TransactionDialog';

// One table row: the transaction with what the cells show resolved once.
type TransactionRow = Transaction & {
  stock: Stock | null;
  exchangeDisplay: string | null;
};

const exchangeDisplay = (
  stock: Stock | null,
  transaction: Transaction
): string | null => {
  if (transaction.onvistaExchangeId === null) return transaction.exchange;

  return (
    stock?.exchanges.find(
      e => e.onvistaExchangeId === transaction.onvistaExchangeId
    )?.name ?? `[${transaction.onvistaExchangeId}]`
  );
};

const toRow = (
  stocks: StocksState,
  transaction: Transaction
): TransactionRow => {
  const stock = findStock(stocks, transaction.isin);
  return {
    ...transaction,
    stock,
    exchangeDisplay: exchangeDisplay(stock, transaction),
  };
};

interface Kind {
  label: string;
  icon: LucideIcon;
  className: string;
}

// Transactions without units only move money: dividends. The colours stay
// clear of teal and pink, which mean gain and loss in the amounts next to them.
const kindOf = ({ units }: Transaction): Kind => {
  if (units > 0)
    return {
      label: 'Kauf',
      icon: CirclePlus,
      className: 'text-sky-600 dark:text-sky-400',
    };
  if (units < 0)
    return {
      label: 'Verkauf',
      icon: CircleMinus,
      className: 'text-violet-600 dark:text-violet-400',
    };
  return {
    label: 'Dividende',
    icon: HandCoins,
    className: 'text-amber-600 dark:text-amber-400',
  };
};

// Phones only have room for whole euros.
const Money = ({ cents }: { cents: number }) => {
  const { signColor } = useTableFormat();
  return (
    <span className="tabular-nums" style={signColor(cents / 100, 2)}>
      <span className="md:hidden">
        {formatCurrency(cents / 100, { digits: 0 })}
      </span>
      <span className="hidden md:inline">{formatCurrency(cents / 100)}</span>
    </span>
  );
};

const column = createColumnHelper<typeof dataTableFeatures, TransactionRow>();

const columns = column.columns([
  column.accessor(row => kindOf(row).label, {
    id: 'kind',
    header: 'Art',
    cell: ({ row }) => {
      const { label, icon: Icon, className } = kindOf(row.original);
      return (
        <span title={label}>
          <Icon aria-hidden className={`size-4 ${className}`} />
          <span className="sr-only">{label}</span>
        </span>
      );
    },
  }),
  column.accessor(row => Temporal.Instant.from(row.date).epochMilliseconds, {
    id: 'date',
    header: 'Datum',
    meta: { icon: CalendarDays },
    cell: ({ row }) => (
      <>
        <span className="md:hidden">{formatDate(row.original.date)}</span>
        <span className="hidden md:inline">
          {formatDateTime(row.original.date)}
        </span>
      </>
    ),
  }),
  column.accessor('amount', {
    header: 'Betrag',
    meta: { icon: Euro },
    cell: ({ getValue }) => <Money cents={getValue()} />,
  }),
  column.accessor('fees', {
    header: 'Gebühren',
    meta: { desktopOnly: true },
    cell: ({ getValue }) => <Money cents={getValue()} />,
  }),
  column.accessor(row => row.stock?.title ?? row.isin, {
    id: 'stock',
    header: 'Wertpapier',
    enableSorting: false,
    meta: { icon: ChartLine },
    cell: ({ row }) => {
      const { stock, isin } = row.original;
      if (stock === null) return isin;

      return (
        <span className="flex min-w-40 items-center gap-2 whitespace-normal">
          <Link
            to={`/stocks/${isin}`}
            className="line-clamp-2 underline-offset-4 hover:underline"
            // the row itself opens the transaction
            onClick={event => event.stopPropagation()}
          >
            <span className="md:hidden">
              {abbreviateTitle(stock.title, true)}
            </span>
            <span className="hidden md:inline">
              {abbreviateTitle(stock.title, false)}
            </span>
          </Link>
          <Badge variant="secondary">{stock.kind}</Badge>
        </span>
      );
    },
  }),
  column.accessor('exchangeDisplay', {
    header: 'Handelsplatz',
    meta: { icon: Building2, desktopOnly: true },
  }),
  column.accessor('comments', {
    header: 'Kommentare',
    meta: { icon: MessageSquare, desktopOnly: true },
  }),
]);

const Transactions = () => {
  const dispatch = useAppDispatch();
  const stocks = useAppSelector(state => state.stocks);
  const transactions = useAppSelector(state => state.transactions);
  const accounts = useAppSelector(state => state.accounts);
  const [transactionId, setTransactionId] = useQueryParam('id');
  const [uploading, setUploading] = useQueryParam('upload');
  const [page, setPage] = useQueryParam('page');

  useEffect(() => {
    dispatch(fetchTransactions());
    dispatch(fetchStocks());
    dispatch(fetchAccounts());
  });

  const newTransaction: TransactionDraft = {
    id: null,
    accountId: accounts.items.length === 1 ? accounts.items[0].id : null,
    isin: null,
    date: Temporal.Now.instant().toString(),
    units: 0,
    fees: 0,
    amount: 0,
    comments: '',
    onvistaExchangeId: null,
    exchange: null,
    receiptNumber: null,
  };
  const initialTransaction =
    transactions.items.find(item => String(item.id) === transactionId) ??
    newTransaction;

  const isLoading =
    transactions.isFetching || stocks.isFetching || accounts.isFetching;

  // The table recomputes its row models whenever `data` is a new array.
  const rows = useMemo(
    () => transactions.items.map(transaction => toRow(stocks, transaction)),
    [transactions.items, stocks]
  );

  return (
    <>
      <Card className="mx-auto max-w-(--breakpoint-xl)">
        <CardHeader>
          <CardTitle>Transaktionen</CardTitle>
          <CardAction className="flex gap-2">
            <Button asChild size="sm" variant="outline">
              <label>
                <Upload />
                <span className="max-sm:sr-only">Abrechnungen</span>
                <input
                  type="file"
                  className="sr-only"
                  accept="application/pdf"
                  multiple
                  onChange={event => {
                    setUploading(true);
                    dispatch(uploadReceipts(event.target.files ?? []));
                  }}
                />
              </label>
            </Button>
            <Button size="sm" onClick={() => setTransactionId(-1)}>
              <Plus />
              <span className="max-sm:sr-only">Neue Transaktion</span>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <DataTable
            data={rows}
            columns={columns}
            getRowId={transaction => String(transaction.id)}
            initialSorting={[{ id: 'date', desc: true }]}
            isLoading={isLoading}
            emptyText="Noch keine Transaktionen"
            page={page === null ? 0 : parseInt(page, 10)}
            onPageChange={p => setPage(p === 0 ? null : p)}
            onRowClick={transaction => setTransactionId(transaction.id)}
          />
        </CardContent>
      </Card>
      <TransactionDialog
        initialTransaction={initialTransaction}
        open={transactionId !== null && !isLoading}
        onClose={() => setTransactionId(null)}
      />
      <ReceiptUploadDialog
        open={uploading !== null}
        onClose={() => setUploading(null)}
      />
    </>
  );
};

export default Transactions;
