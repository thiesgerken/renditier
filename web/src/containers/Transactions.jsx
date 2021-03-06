import { connect } from 'react-redux';
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import MUIDataTable from 'mui-datatables';
import moment from 'moment';
import { find, map } from 'lodash';
import {
  ThemeProvider,
  createMuiTheme,
  useTheme,
  useMediaQuery,
  Container,
  Button,
  CircularProgress,
  Tooltip,
  IconButton,
} from '@material-ui/core';
import ShowChartIcon from '@material-ui/icons/ShowChart';
import AddIcon from '@material-ui/icons/Add';
import CloudUploadIcon from '@material-ui/icons/CloudUpload';
import { useLocation, useHistory } from 'react-router';

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
  const history = useHistory();

  const set = value => {
    if (value === null || value === undefined) query.delete(key);
    else query.set(key, value);

    const qs = query.toString();
    history.push(`${location.pathname}${qs.length ? '?' : ''}${qs}`);
  };

  return [query.get(key), set];
}

const manipulateExchange = (stocks, x) => {
  let ex = null;
  if (x.exchange !== null) ex = x.exchange;
  if (x.onvistaExchangeId !== null) {
    ex = `[${x.onvistaExchangeId}]`;

    const stock = findStock(stocks, x.isin);
    if (stock !== null) {
      const e = find(
        stock.exchanges,
        ee => ee.onvistaExchangeId === x.onvistaExchangeId
      );

      if (e !== undefined && e !== null) ex = e.name;
    }
  }

  return {
    ...x,
    exchangeDisplay: ex,
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

  let initialTransaction = {
    id: null,
    accountId: accounts.items.length === 1 ? accounts.items[0].id : null,
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
    const t = find(
      transactions.items,
      x => x.id === parseInt(transactionId, 10)
    );
    if (t !== undefined) initialTransaction = t;
  }

  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  const myTheme = th =>
    createMuiTheme({
      ...th,
      overrides: {
        ...th.overrides,
        MuiTableRow: {
          root: {
            // '&$selected': {
            //   backgroundColor: theme.palette.primary.light,
            // },
          },
        },
        MUIDataTableSelectCell: {
          root: {
            display: 'none',
          },
        },
      },
    });

  const colorize = v =>
    v === null || v === undefined || v === 0
      ? {}
      : {
          color:
            v < 0 ? theme.palette.secondary.dark : theme.palette.primary.dark,
        };

  const formatAmount = value => (
    <span style={colorize(value)}>
      {`${(value / 100).toFixed(mdUp ? 2 : 0)}€`}
    </span>
  );

  const history = useHistory();

  useEffect(() => {
    updateTransactions();
    updateStocks();
    updateAccounts();
  });

  const isLoading =
    transactions.isFetching || stocks.isFetching || accounts.isFetching;

  const columns = [
    {
      name: 'id',
      label: 'ID',
      options: {
        filter: false,
        display: false,
      },
    },
    {
      name: 'date',
      label: 'Datum',
      options: {
        filter: false,
        customBodyRender: d => moment(d).format(mdUp ? 'L LT' : 'L'),
      },
    },
    {
      name: 'amount',
      label: 'Betrag',
      options: {
        filter: false,
        customBodyRender: formatAmount,
      },
    },
    {
      name: 'fees',
      label: 'Gebühren',
      options: {
        filter: false,
        customBodyRender: formatAmount,
        display: mdUp,
      },
    },
    {
      name: 'isin',
      label: 'Wertpapier',
      options: {
        customBodyRender: isin => {
          const stock = findStock(stocks, isin);
          if (stock === null) return isin;

          return (
            <Button
              variant="text"
              color="primary"
              startIcon={<ShowChartIcon />}
              style={{
                margin: theme.spacing(-2),
              }}
              onClick={() => history.push(`/stocks/${stock.isin}`)}
            >
              <span
                style={{
                  wordWrap: 'break-word',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitBoxOrient: 'vertical',
                  // wordBreak: 'break-all',
                  WebkitLineClamp: 2,
                  textAlign: 'left',
                }}
              >
                {abbreviateTitle(stock.title, !mdUp)}
              </span>
            </Button>
          );
        },
      },
    },
    {
      name: 'isin',
      label: 'ISIN',
      options: {
        display: false,
      },
    },
    {
      name: 'units',
      label: 'Einheiten',
      options: {
        filter: false,
        display: false,
        customBodyRender: v => <span style={colorize(v)}>{v}</span>,
      },
    },
    {
      name: 'accountId',
      label: 'Konto',
      options: {
        display: false,
      },
    },
    {
      name: 'exchangeDisplay',
      label: 'Handelsplatz',
      options: {
        display: mdUp,
      },
    },
    {
      name: 'comments',
      label: 'Kommentare',
      options: {
        filter: false,
        display: mdUp,
      },
    },
  ];

  const options = {
    selectToolbarPlacement: 'none',
    enableNestedDataAccess: '.',
    selectableRows: 'single',
    selectableRowsOnClick: true,
    // expandableRowsOnClick: true,
    sortOrder: {
      name: 'date',
      direction: 'desc',
    },
    print: false,
    page: page === null ? 0 : parseInt(page, 10), // https://github.com/gregnb/mui-datatables/issues/957
    onChangePage: p => {
      setPage(p === 0 ? null : p);
    },
    // pagination: mdUp,
    // expandableRows: true,
    // renderExpandableRow: rowData => {
    //   const colSpan = rowData.length + 1;
    //   return (
    //     <TableRow>
    //       <TableCell colSpan={colSpan}>Custom expandable row option.</TableCell>
    //     </TableRow>
    //   );
    // },
    onRowSelectionChange: (_, rows) => {
      if (rows.length > 0 && rows[0].dataIndex < transactions.items.length)
        setTransactionId(transactions.items[rows[0].dataIndex].id);
      else setTransactionId(null);
    },
    // onRowClick: (_, { dataIndex }) => {
    //   if (dataIndex < transactions.items.length) {
    //     setCurrentTransaction(transactions.items[dataIndex]);
    //     console.log(transactions.items[dataIndex]);
    //   } else setCurrentTransaction(null);
    // },
    download: false,
    rowsPerPageOptions: mdUp ? [10, 25, 50] : [10],
    responsive: 'standard',
    customToolbar: () => (
      <>
        <Tooltip title="Abrechnungen hochladen">
          <IconButton component="label">
            <input
              type="file"
              hidden
              accept="application/pdf"
              multiple
              onChange={e => {
                setUploading(true);
                uploadReceipts(e.target.files);
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
      </>
    ),
    textLabels: {
      body: {
        noMatch: 'Keine Transaktionen vorhanden.',
        toolTip: 'Sortieren',
        columnHeaderTooltip: column => `Sortiere nach ${column.label}`,
      },
      pagination: {
        next: 'Nächste Seite',
        previous: 'Vorherige Seite',
        rowsPerPage: 'Zeilen pro Seite:',
        displayRows: 'von',
      },
      toolbar: {
        search: 'Suchen',
        viewColumns: 'Spalten',
        filterTable: 'Filter',
      },
      filter: {
        all: 'Alle',
        title: 'FILTER',
        reset: 'RESET',
      },
      viewColumns: {
        title: 'Angezeigte Spalten',
        titleAria: 'Zeigen/Ausblenden von Tabellenspalten',
      },
      selectedRows: {
        text: 'Zeile(n) ausgewählt',
        delete: 'Löschen',
        deleteAria: 'ausgewählte Zeilen löschen',
      },
    },
  };
  return (
    <div style={{ margin: '-4px' }}>
      <Container maxWidth="xl" style={{ padding: '0px' }}>
        <div style={{ position: 'relative', height: '100%', width: '100%' }}>
          {isLoading && (
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: '50%',
                transform: 'translate(0%, -0%)',
                width: '0%',
                height: '0%',
                padding: '0px',
                margin: 0,
                zIndex: 9,
              }}
            >
              <CircularProgress color="secondary" />
            </div>
          )}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: '100%',
              left: '0',
              top: '0',
            }}
          >
            <ThemeProvider theme={myTheme}>
              <MUIDataTable
                title="Transaktionen"
                data={map(transactions.items, x =>
                  manipulateExchange(stocks, x)
                )}
                columns={columns}
                options={options}
              />
            </ThemeProvider>
          </div>
        </div>
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

Transactions.propTypes = {
  updateTransactions: PropTypes.func.isRequired,
  updateStocks: PropTypes.func.isRequired,
  updateAccounts: PropTypes.func.isRequired,
  uploadReceipts: PropTypes.func.isRequired,
  transactions: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
  stocks: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
  accounts: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
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
