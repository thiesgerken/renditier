import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';
import React, { useEffect } from 'react';
import { find } from 'lodash';
import {
  Box,
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
  GridRowParams,
} from '@mui/x-data-grid';
import { deDE } from '@mui/x-data-grid/locales';
import AddIcon from '@mui/icons-material/Add';
import { useLocation, useNavigate } from 'react-router-dom';

import { updateAccounts as updateAccountsAction } from '../actions/accounts';
import type { AppDispatch } from '../types/actions';
import type { Account } from '../types/api';
import type { RootState } from '../types/store';
import AccountDialog from './AccountDialog';
import type { AccountDraft } from './AccountDialog';

function useQuery(
  key: string
): [string | null, (value: string | number | null) => void] {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const navigate = useNavigate();

  const set = (value: string | number | null) => {
    if (value === null || value === undefined) query.delete(key);
    else query.set(key, `${value}`);

    const qs = query.toString();
    navigate(`${location.pathname}${qs.length ? '?' : ''}${qs}`);
  };

  return [query.get(key), set];
}

const Accounts = ({ accounts, updateAccounts }: Props) => {
  const [accountId, setAccountId] = useQuery('id');
  const [page, setPage] = useQuery('page');
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [pageSize, setPageSize] = React.useState(10);

  useEffect(() => {
    updateAccounts();
  });

  let initialAccount: AccountDraft = {
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
    const account = find(
      accounts.items,
      item => item.id === parseInt(accountId, 10)
    );
    if (account !== undefined) initialAccount = account;
  }

  const columns: GridColDef[] = [
    {
      field: 'id',
      headerName: 'ID',
    },
    {
      field: 'name',
      headerName: 'Name',
      flex: 1,
      minWidth: 160,
    },
    {
      field: 'iban',
      headerName: 'IBAN',
      flex: 1,
      minWidth: 220,
    },
  ];

  const isLoading = accounts.isFetching;
  const rows = accounts.items ?? [];
  const pageNumber = page === null ? 0 : parseInt(page, 10);

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
            <Typography variant="h6">Depots</Typography>
            <Tooltip title="Neues Depot">
              <IconButton onClick={() => setAccountId(-1)}>
                <AddIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <DataGrid
            autoHeight
            rows={rows}
            columns={columns}
            loading={isLoading}
            disableRowSelectionOnClick
            pagination
            columnVisibilityModel={{ id: false }}
            initialState={{
              sorting: { sortModel: [{ field: 'name', sort: 'asc' }] },
            }}
            localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
            pageSizeOptions={mdUp ? [10, 25, 50] : [10]}
            paginationModel={{ page: pageNumber, pageSize }}
            onPaginationModelChange={(model: GridPaginationModel) => {
              setPageSize(model.pageSize);
              setPage(model.page === 0 ? null : model.page);
            }}
            onRowClick={(params: GridRowParams<Account>) =>
              setAccountId(params.row.id)
            }
            sx={{ border: 0 }}
          />
        </Paper>
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

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  updateAccounts: () => dispatch(updateAccountsAction()),
});

const mapStateToProps = (state: RootState) => {
  const { accounts } = state;

  return {
    accounts,
  };
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

export default connector(Accounts);
