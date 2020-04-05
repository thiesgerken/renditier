import React from 'react';
import PropTypes from 'prop-types';
import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { Container, Hidden } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import { map } from 'lodash';
import * as moment from 'moment';

import TransactionRow from './TransactionRow';

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
  transactions: PropTypes.arrayOf(PropTypes.object).isRequired,
  currentPrice: PropTypes.shape({}),
};

TransactionsTable.defaultProps = { currentPrice: null };

export default TransactionsTable;
