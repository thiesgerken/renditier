import { connect } from 'react-redux';
import React, { useEffect } from 'react';
import PropTypes from 'prop-types';
import MUIDataTable from 'mui-datatables';
import { find } from 'lodash';
import {
  ThemeProvider,
  createMuiTheme,
  useTheme,
  useMediaQuery,
  Container,
  CircularProgress,
  Tooltip,
  IconButton,
} from '@material-ui/core';
import AddIcon from '@material-ui/icons/Add';
import { useLocation, useHistory } from 'react-router';

import { updateAccounts as updateAccountsAction } from '../actions/accounts';
import AccountDialog from './AccountDialog';

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

const Accounts = ({ accounts, updateAccounts }) => {
  const [accountId, setAccountId] = useQuery('id');
  const [page, setPage] = useQuery('page');

  let initialAccount = {
    id: null,
    userId: -1,
    name: '',
    iban: '',
  };
  if (
    accounts.items !== null &&
    accountId !== null &&
    parseInt(accountId, 10) >= 0
  ) {
    const a = find(accounts.items, x => x.id === parseInt(accountId, 10));
    if (a !== undefined) initialAccount = a;
  }

  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));

  const myTheme = th =>
    createMuiTheme({
      ...th,
      overrides: {
        ...th.overrides,
        MUIDataTableSelectCell: {
          root: {
            display: 'none',
          },
        },
      },
    });

  useEffect(() => {
    updateAccounts();
  });

  const isLoading = accounts.isFetching;

  const columns = [
    {
      name: 'id',
      label: 'ID',
      options: {
        display: false,
      },
    },
    {
      name: 'name',
      label: 'Name',
    },
    {
      name: 'iban',
      label: 'IBAN',
    },
  ];

  const options = {
    selectToolbarPlacement: 'none',
    enableNestedDataAccess: '.',
    selectableRows: 'single',
    selectableRowsOnClick: true,
    print: false,
    page: page === null ? 0 : parseInt(page, 10), // https://github.com/gregnb/mui-datatables/issues/957
    onChangePage: p => {
      setPage(p === 0 ? null : p);
    },
    onRowSelectionChange: (_, rows) => {
      if (rows.length > 0 && rows[0].dataIndex < accounts.items.length)
        setAccountId(accounts.items[rows[0].dataIndex].id);
      else setAccountId(null);
    },
    sortOrder: {
      name: 'name',
      direction: 'asc',
    },
    download: false,
    filter: false,
    rowsPerPageOptions: mdUp ? [10, 25, 50] : [10],
    responsive: 'standard',
    customToolbar: () => (
      <>
        <Tooltip title="Neues Depot">
          <IconButton onClick={() => setAccountId(-1)}>
            <AddIcon />
          </IconButton>
        </Tooltip>
      </>
    ),
    textLabels: {
      body: {
        noMatch: 'Keine Depots vorhanden.',
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
                title="Depots"
                data={accounts.items}
                columns={columns}
                options={options}
              />
            </ThemeProvider>
          </div>
        </div>
      </Container>
      <AccountDialog
        initialAccount={initialAccount}
        open={accountId !== null && !isLoading}
        onClose={() => {
          setAccountId(null);
        }}
      />
    </div>
  );
};

Accounts.propTypes = {
  updateAccounts: PropTypes.func.isRequired,
  accounts: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
};

const mapDispatchToProps = dispatch => ({
  updateAccounts: () => dispatch(updateAccountsAction()),
});

const mapStateToProps = state => {
  const { accounts } = state;

  return {
    accounts,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(Accounts);
