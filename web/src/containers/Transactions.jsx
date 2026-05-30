import { connect } from 'react-redux';
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
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
import { deDE } from '@mui/x-data-grid/locales';
import ShowChartIcon from '@mui/icons-material/ShowChart';
import AddIcon from '@mui/icons-material/Add';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useLocation, useNavigate } from 'react-router-dom';

import { updateTransactions as updateTransactionsAction } from '../actions/transactions';
import { updateStocks as updateStocksAction } from '../actions/api';
import { updateAccounts as updateAccountsAction } from '../actions/accounts';
import { uploadReceipts as uploadReceiptsAction } from '../actions/receipts';
import { findStock, abbreviateTitle } from '../selectors/stocks';
import TransactionDialog from './TransactionDialog';
import ReceiptUploadDialog from './ReceiptUploadDialog';

function useQuery(key) {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const navigate = useNavigate();

  const set = value => {
    if (value === null || value === undefined) query.delete(key);
    else query.set(key, value);

    const qs = query.toString();
    navigate(`${location.pathname}${qs.length ? '?' : ''}${qs}`);
  };

  return [query.get(key), set];
}

const manipulateExchange = (stocks, transaction) => {
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

const Transactions = ({
  stocks,
  transactions,
  accounts,
  updateStocks,
  updateTransactions,
  updateAccounts,
  uploadReceipts,
}) => {
  const [transactionId, setTransactionId] = useQuery('id');
  const [uploading, setUploading] = useQuery('upload');
  const [page, setPage] = useQuery('page');
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const navigate = useNavigate();
  const [pageSize, setPageSize] = React.useState(10);

  const onlyAccount =
    accounts.items !== null && accounts.items.length === 1
      ? accounts.items[0].id
      : null;
  let initialTransaction = {
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
    updateTransactions();
    updateStocks();
    updateAccounts();
  });

  const isLoading =
    transactions.isFetching || stocks.isFetching || accounts.isFetching;

  const colorize = value =>
    value === null || value === undefined || value === 0
      ? {}
      : {
          color:
            value < 0
              ? theme.palette.secondary.dark
              : theme.palette.primary.dark,
        };

  const formatAmount = value => (
    <span style={colorize(value)}>{`${(value / 100).toFixed(
      mdUp ? 2 : 0
    )}€`}</span>
  );

  const rows = (transactions.items ?? []).map(transaction =>
    manipulateExchange(stocks, transaction)
  );
  const pageNumber = page === null ? 0 : parseInt(page, 10);

  const columns = [
    {
      field: 'id',
      headerName: 'ID',
    },
    {
      field: 'date',
      headerName: 'Datum',
      minWidth: mdUp ? 150 : 110,
      renderCell: params => moment(params.value).format(mdUp ? 'L LT' : 'L'),
    },
    {
      field: 'amount',
      headerName: 'Betrag',
      minWidth: 110,
      renderCell: params => formatAmount(params.value),
    },
    {
      field: 'fees',
      headerName: 'Gebühren',
      minWidth: 110,
      renderCell: params => formatAmount(params.value),
    },
    {
      field: 'stockTitle',
      headerName: 'Wertpapier',
      flex: 1,
      minWidth: mdUp ? 260 : 170,
      sortable: false,
      renderCell: params => {
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
            onClick={event => {
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
      renderCell: params => (
        <span style={colorize(params.value)}>{params.value}</span>
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
                    onChange={event => {
                      setUploading(true);
                      uploadReceipts(event.target.files);
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
            onPaginationModelChange={model => {
              setPageSize(model.pageSize);
              setPage(model.page === 0 ? null : model.page);
            }}
            onRowClick={params => setTransactionId(params.row.id)}
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

const accountType = PropTypes.shape({
  id: PropTypes.number,
});

Transactions.propTypes = {
  updateTransactions: PropTypes.func.isRequired,
  updateStocks: PropTypes.func.isRequired,
  updateAccounts: PropTypes.func.isRequired,
  uploadReceipts: PropTypes.func.isRequired,
  transactions: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.shape({})),
    isFetching: PropTypes.bool,
  }).isRequired,
  stocks: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.shape({})),
    isFetching: PropTypes.bool,
  }).isRequired,
  accounts: PropTypes.shape({
    items: PropTypes.arrayOf(accountType),
    isFetching: PropTypes.bool,
  }).isRequired,
};

const mapDispatchToProps = dispatch => ({
  updateTransactions: () => dispatch(updateTransactionsAction()),
  updateStocks: () => dispatch(updateStocksAction()),
  updateAccounts: () => dispatch(updateAccountsAction()),
  uploadReceipts: inputFiles => dispatch(uploadReceiptsAction(inputFiles)),
});

const mapStateToProps = state => {
  const { transactions, stocks, accounts } = state;

  return {
    transactions,
    stocks,
    accounts,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Transactions);
