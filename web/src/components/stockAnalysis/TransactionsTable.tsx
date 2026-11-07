import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { Container } from '@mui/material';
import { styled } from '@mui/material/styles';
import { map } from 'lodash';
import moment from 'moment';

import TransactionRow from './TransactionRow';
import Hidden from '../Hidden';
import type { DataSource, EitherPrice, Transaction } from '../../types/api';

interface Props {
  transactions: Transaction[];
  currentPrice?: DataSource<EitherPrice> | null;
}

const StyledTableCell = styled(TableCell)({
  '&.MuiTableCell-head': {
    fontWeight: 600,
  },
});

const TransactionsTable = ({ transactions, currentPrice = null }: Props) => {
  // Sorts a copy: the store freezes its state.
  const newestFirst = [...transactions].sort(
    (a, b) => moment(b.date).valueOf() - moment(a.date).valueOf()
  );

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
              {map(newestFirst, t => (
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

export default TransactionsTable;
