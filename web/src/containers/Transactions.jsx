import { connect } from 'react-redux';
import React from 'react';
import PropTypes from 'prop-types';
import MUIDataTable from 'mui-datatables';
import moment from 'moment';
import {
  ThemeProvider,
  createMuiTheme,
  useTheme,
  useMediaQuery,
} from '@material-ui/core';

import { updateTransactions as updateTransactionsAction } from '../actions/transactions';
import { updateStocks as updateStocksAction } from '../actions/stocks';

const Transactions = ({
  stocks,
  transactions,
  updateStocks,
  updateTransactions,
}) => {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  const myTheme = createMuiTheme({
    overrides: {
      // MuiTableRow: {
      //   root: {
      //     '&$selected': {
      //       backgroundColor: theme.palette.primary.light,
      //     },
      //   },
      // },
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

  updateTransactions();
  updateStocks();

  console.log(stocks);

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
      name: 'accountId',
      label: 'Konto',
      options: {
        display: false,
      },
    },
    {
      name: 'isin',
      label: 'Wertpapier',
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
      name: 'units',
      label: 'Einheiten',
      options: {
        filter: false,
        display: false,
        customBodyRender: v => <span style={colorize(v)}>{v}</span>,
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
    selectableRows: 'none',
    selectableRowsOnClick: true,
    disableToolbarSelect: true,
    print: false,
    // pagination: mdUp,
    download: false,
    rowsPerPageOptions: mdUp ? [10, 25, 50] : [10],
    responsive: 'scrollFullHeight',
    textLabels: {
      body: {
        noMatch: 'Sorry, no matching records found',
        toolTip: 'Sort',
        columnHeaderTooltip: column => `Sort for ${column.label}`,
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
      <ThemeProvider theme={myTheme}>
        <MUIDataTable
          title="Transaktionen"
          data={transactions.items}
          columns={columns}
          options={options}
        />
      </ThemeProvider>
    </div>
  );
};

Transactions.propTypes = {
  updateTransactions: PropTypes.func.isRequired,
  updateStocks: PropTypes.func.isRequired,
  transactions: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
  }).isRequired,
  stocks: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
  }).isRequired,
};

const mapDispatchToProps = dispatch => ({
  updateTransactions: () => dispatch(updateTransactionsAction()),
  updateStocks: () => dispatch(updateStocksAction()),
});

const mapStateToProps = state => {
  const { transactions, stocks } = state;

  return {
    transactions,
    stocks,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Transactions);
