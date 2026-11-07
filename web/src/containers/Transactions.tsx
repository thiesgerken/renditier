import React, { useEffect } from 'react';
import moment from 'moment';
import { find } from 'lodash';
import {
  Box,
  Button,
  Container,
  IconButton,
  Paper,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import { DataGrid } from '@mui/x-data-grid';
import type {
  GridColDef,
  GridPaginationModel,
  GridRenderCellParams,
  GridRowParams,
} from '@mui/x-data-grid';
import { deDE } from '@mui/x-data-grid/locales';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useLocation, useNavigate } from 'react-router-dom';

import { fetchTransactions } from '../slices/transactions';
import { fetchStocks } from '../slices/stocks';
import { fetchAccounts } from '../slices/accounts';
import { uploadReceipts } from '../slices/receipts';
import { findStock, abbreviateTitle } from '../selectors/stocks';
import { useAppDispatch, useAppSelector } from '../store';
import type { Transaction } from '../types/api';
import type { StocksState } from '../types/store';
import TransactionDialog from './TransactionDialog';
import type { TransactionDraft } from './TransactionDialog';
import ReceiptUploadDialog from './ReceiptUploadDialog';
import useTableFormat from '../components/useTableFormat';
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  formatNumber,
} from '../format';

// One DataGrid row: the transaction plus the resolved exchange name.
type TransactionRow = Transaction & { exchangeDisplay: string | null };

// Savings plans buy fractional units, so units keep all their decimals.
const UNIT_DIGITS = 6;

function useQuery(
  key: string
): [string | null, (value: string | number | boolean | null) => void] {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const navigate = useNavigate();

  const set = (value: string | number | boolean | null) => {
    if (value === null || value === undefined) query.delete(key);
    else query.set(key, `${value}`);

    const qs = query.toString();
    navigate(`${location.pathname}${qs.length ? '?' : ''}${qs}`);
  };

  return [query.get(key), set];
}

const manipulateExchange = (
  stocks: StocksState,
  transaction: Transaction
): TransactionRow => {
  let exchangeDisplay = null;
  if (transaction.exchange !== null) exchangeDisplay = transaction.exchange;
  if (transaction.onvistaExchangeId !== null) {
    exchangeDisplay = `[${transaction.onvistaExchangeId}]`;

    const stock = findStock(stocks, transaction.isin);
    if (stock !== null) {
      const exchange = find(
        stock.exchanges,
        item => item.onvistaExchangeId === transaction.onvistaExchangeId
      );

      if (exchange !== undefined && exchange !== null) {
        exchangeDisplay = exchange.name;
      }
    }
  }

  return {
    ...transaction,
    exchangeDisplay,
  };
};

const Transactions = () => {
  const dispatch = useAppDispatch();
  const stocks = useAppSelector(state => state.stocks);
  const transactions = useAppSelector(state => state.transactions);
  const accounts = useAppSelector(state => state.accounts);
  const [transactionId, setTransactionId] = useQuery('id');
  const [uploading, setUploading] = useQuery('upload');
  const [page, setPage] = useQuery('page');
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const { signColor } = useTableFormat();
  const navigate = useNavigate();
  const [pageSize, setPageSize] = React.useState(10);

  const onlyAccount =
    accounts.items !== null && accounts.items.length === 1
      ? accounts.items[0].id
      : null;
  let initialTransaction: TransactionDraft = {
    id: null,
    accountId: onlyAccount,
    isin: null,
    date: moment().format(),
    units: 0,
    fees: 0,
    amount: 0,
    comments: '',
    onvistaExchangeId: null,
    exchange: null,
    // FIXME(tsx-migration): the blank transaction never carried this key, so the
    // create payload omitted it entirely; null is what the backend inferred.
    receiptNumber: null,
  };
  if (
    transactions.items !== null &&
    transactionId !== null &&
    parseInt(transactionId, 10) >= 0
  ) {
    const transaction = find(
      transactions.items,
      item => item.id === parseInt(transactionId, 10)
    );
    if (transaction !== undefined) initialTransaction = transaction;
  }

  useEffect(() => {
    dispatch(fetchTransactions());
    dispatch(fetchStocks());
    dispatch(fetchAccounts());
  });

  const isLoading =
    transactions.isFetching || stocks.isFetching || accounts.isFetching;

  const formatAmount = (cents: number) => (
    <span style={signColor(cents / 100, mdUp ? 2 : 0)}>
      {formatCurrency(cents / 100, { digits: mdUp ? 2 : 0 })}
    </span>
  );

  const rows = (transactions.items ?? []).map(transaction =>
    manipulateExchange(stocks, transaction)
  );
  const pageNumber = page === null ? 0 : parseInt(page, 10);

  const columns: GridColDef<TransactionRow>[] = [
    {
      field: 'id',
      headerName: 'ID',
    },
    {
      field: 'date',
      headerName: 'Datum',
      minWidth: mdUp ? 150 : 110,
      renderCell: (params: GridRenderCellParams<TransactionRow, string>) =>
        mdUp ? formatDateTime(params.value) : formatDate(params.value),
    },
    {
      field: 'amount',
      headerName: 'Betrag',
      minWidth: 110,
      renderCell: (params: GridRenderCellParams<TransactionRow, number>) =>
        formatAmount(params.value ?? 0),
    },
    {
      field: 'fees',
      headerName: 'Gebühren',
      minWidth: 110,
      renderCell: (params: GridRenderCellParams<TransactionRow, number>) =>
        formatAmount(params.value ?? 0),
    },
    {
      field: 'stockTitle',
      headerName: 'Wertpapier',
      flex: 1,
      minWidth: mdUp ? 260 : 170,
      sortable: false,
      renderCell: (params: GridRenderCellParams<TransactionRow>) => {
        const stock = findStock(stocks, params.row.isin);
        if (stock === null) return params.row.isin;

        return (
          <Button
            variant="text"
            color="primary"
            startIcon={<ShowChartIcon />}
            sx={{
              justifyContent: 'flex-start',
              m: -2,
              maxWidth: '100%',
              textAlign: 'left',
              textTransform: 'none',
            }}
            onClick={(event: React.MouseEvent<HTMLButtonElement>) => {
              event.stopPropagation();
              navigate(`/stocks/${stock.isin}`);
            }}
          >
            <span
              style={{
                display: '-webkit-box',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                WebkitBoxOrient: 'vertical',
                WebkitLineClamp: 2,
                wordWrap: 'break-word',
              }}
            >
              {abbreviateTitle(stock.title, !mdUp)}
            </span>
          </Button>
        );
      },
    },
    {
      field: 'isin',
      headerName: 'ISIN',
    },
    {
      field: 'units',
      headerName: 'Einheiten',
      renderCell: (params: GridRenderCellParams<TransactionRow, number>) => (
        <span style={signColor(params.value, UNIT_DIGITS)}>
          {formatNumber(params.value ?? null, {
            digits: 0,
            maxDigits: UNIT_DIGITS,
          })}
        </span>
      ),
    },
    {
      field: 'accountId',
      headerName: 'Konto',
    },
    {
      field: 'exchangeDisplay',
      headerName: 'Handelsplatz',
      flex: 1,
      minWidth: 150,
    },
    {
      field: 'comments',
      headerName: 'Kommentare',
      flex: 1,
      minWidth: 180,
    },
  ];

  return (
    <div style={{ margin: '-4px' }}>
      <Container maxWidth="xl" style={{ padding: '0px' }}>
        <Paper>
          <Box
            sx={{
              alignItems: 'center',
              display: 'flex',
              justifyContent: 'space-between',
              px: 2,
              py: 1,
            }}
          >
            <Typography variant="h6">Transaktionen</Typography>
            <Box>
              <Tooltip title="Abrechnungen hochladen">
                <IconButton component="label">
                  <input
                    type="file"
                    hidden
                    accept="application/pdf"
                    multiple
                    onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
                      setUploading(true);
                      dispatch(uploadReceipts(event.target.files ?? []));
                    }}
                  />
                  <CloudUploadIcon />
                </IconButton>
              </Tooltip>
              <Tooltip title="Neue Transaktion">
                <IconButton onClick={() => setTransactionId(-1)}>
                  <AddIcon />
                </IconButton>
              </Tooltip>
            </Box>
          </Box>
          <DataGrid
            autoHeight
            rows={rows}
            columns={columns}
            loading={isLoading}
            disableRowSelectionOnClick
            pagination
            columnVisibilityModel={{
              id: false,
              isin: false,
              units: false,
              accountId: false,
              fees: mdUp,
              exchangeDisplay: mdUp,
              comments: mdUp,
            }}
            initialState={{
              sorting: { sortModel: [{ field: 'date', sort: 'desc' }] },
            }}
            localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
            pageSizeOptions={mdUp ? [10, 25, 50] : [10]}
            paginationModel={{ page: pageNumber, pageSize }}
            onPaginationModelChange={(model: GridPaginationModel) => {
              setPageSize(model.pageSize);
              setPage(model.page === 0 ? null : model.page);
            }}
            onRowClick={(params: GridRowParams<TransactionRow>) =>
              setTransactionId(params.row.id)
            }
            sx={{ border: 0 }}
          />
        </Paper>
      </Container>
      <TransactionDialog
        initialTransaction={initialTransaction}
        open={transactionId !== null && !isLoading}
        onClose={() => {
          setTransactionId(null);
        }}
      />
      <ReceiptUploadDialog
        open={uploading !== null}
        onClose={() => {
          setUploading(null);
        }}
      />
    </div>
  );
};

export default Transactions;
