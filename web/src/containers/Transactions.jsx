import { connect } from 'react-redux';
import React, { useState } from 'react';
import PropTypes from 'prop-types';
import MUIDataTable from 'mui-datatables';
import moment from 'moment';
import {
  ThemeProvider,
  createMuiTheme,
  useTheme,
  useMediaQuery,
  Container,
  Button,
  CircularProgress,
} from '@material-ui/core';
import ShowChartIcon from '@material-ui/icons/ShowChart';
import { push as routerPush } from 'connected-react-router';

import { updateTransactions as updateTransactionsAction } from '../actions/transactions';
import { updateStocks as updateStocksAction } from '../actions/stocks';
import { findStock, abbreviateTitle } from '../selectors/stocks';
import TransactionDialog from '../components/TransactionDialog';

const Transactions = ({
  stocks,
  transactions,
  updateStocks,
  updateTransactions,
  push,
}) => {
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

  const [currentTransaction, setCurrentTransaction] = useState(null);

  updateTransactions();
  updateStocks();

  const isLoading = transactions.isFetching || stocks.isFetching;

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
        sortDirection: 'desc',
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
              onClick={() => push(`/stocks/${stock.isin}`)}
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
      name: 'onvistaExchangeId',
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

  // TODO: show loading indicator if necessary

  const options = {
    selectableRows: 'single',
    selectableRowsOnClick: true,
    // expandableRowsOnClick: true,
    disableToolbarSelect: true,
    print: false,
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
    onRowsSelect: (_, rows) => {
      if (rows.length > 0 && rows[0].dataIndex < transactions.items.length) {
        setCurrentTransaction(transactions.items[rows[0].dataIndex]);
        console.log(currentTransaction);
      } else setCurrentTransaction(null);
    },
    // onRowClick: (_, { dataIndex }) => {
    //   if (dataIndex < transactions.items.length) {
    //     setCurrentTransaction(transactions.items[dataIndex]);
    //     console.log(transactions.items[dataIndex]);
    //   } else setCurrentTransaction(null);
    // },
    download: false,
    rowsPerPageOptions: mdUp ? [10, 25, 50] : [10],
    responsive: 'scrollFullHeight',
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
                data={transactions.items}
                columns={columns}
                options={options}
              />
            </ThemeProvider>
          </div>
        </div>
      </Container>
      <TransactionDialog
        stocks={stocks}
        transaction={currentTransaction}
        open={currentTransaction !== null}
        onClose={() => setCurrentTransaction(null)}
      >
        {' '}
        Hello!{' '}
      </TransactionDialog>
    </div>
  );
};

Transactions.propTypes = {
  updateTransactions: PropTypes.func.isRequired,
  updateStocks: PropTypes.func.isRequired,
  transactions: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
    isFetching: PropTypes.bool,
  }).isRequired,
  stocks: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
    isFetching: PropTypes.bool,
  }).isRequired,
  push: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  updateTransactions: () => dispatch(updateTransactionsAction()),
  updateStocks: () => dispatch(updateStocksAction()),
  push: x => dispatch(routerPush(x)),
});

const mapStateToProps = state => {
  const { transactions, stocks } = state;

  return {
    transactions,
    stocks,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Transactions);
