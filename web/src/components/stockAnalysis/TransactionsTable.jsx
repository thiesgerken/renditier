import React from 'react';
import PropTypes from 'prop-types';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { Container } from '@mui/material';
import { withStyles } from '@mui/styles';
import { map } from 'lodash';
import * as moment from 'moment';

import TransactionRow from './TransactionRow';
import Hidden from '../Hidden';

const StyledTableCell = withStyles(() => ({
  head: {
    fontWeight: 600,
  },
}))(TableCell);

const TransactionsTable = ({ transactions, currentPrice }) => {
  transactions.sort((a, b) => moment(b.date) - moment(a.date));

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <Paper>
        <TableContainer>
          <Table size="small" aria-label="positions">
            <TableHead>
              <TableRow>
                <StyledTableCell align="left">Datum</StyledTableCell>
                <StyledTableCell align="right">Einheiten</StyledTableCell>
                <Hidden lgDown>
                  <StyledTableCell align="right">Kurs</StyledTableCell>
                </Hidden>
                <StyledTableCell align="right">Betrag</StyledTableCell>
                <StyledTableCell align="right">aktueller Wert</StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {map(transactions, t => (
                <TransactionRow
                  transaction={t}
                  currentPrice={currentPrice}
                  key={t.date}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

TransactionsTable.propTypes = {
  transactions: PropTypes.arrayOf(PropTypes.shape({})).isRequired,
  currentPrice: PropTypes.shape({}),
};

TransactionsTable.defaultProps = { currentPrice: null };

export default TransactionsTable;
