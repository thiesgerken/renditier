import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {
  Container,
  Paper,
  TableBody,
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Hidden,
} from '@material-ui/core';
import { map } from 'lodash';
import React from 'react';
import { withStyles } from '@material-ui/core/styles';

import { updateStocks as updateStocksAction } from '../actions/stocks';
import StockRow from '../components/StockRow';

const StyledTableCell = withStyles(() => ({
  head: {
    fontWeight: 600,
  },
}))(TableCell);

const StockTable = ({ stocks, updateStocks }) => {
  updateStocks();

  // TODO: also include some overview analysis of how well the entries perform (not regarding invested money)
  // TODO: also include a checkbox whether we own something of this thing (and ability to hide the others)

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <Paper>
        <TableContainer>
          <Table size="small" aria-label="positions">
            <TableHead>
              <TableRow>
                <StyledTableCell>ISIN</StyledTableCell>
                <StyledTableCell>Name</StyledTableCell>
                <StyledTableCell>Typ</StyledTableCell>
                <Hidden xsDown>
                  <StyledTableCell>Fokus</StyledTableCell>
                </Hidden>
                <Hidden lgDown>
                  <StyledTableCell>Fondstyp</StyledTableCell>
                </Hidden>
                <Hidden lgDown>
                  <StyledTableCell>Anbieter</StyledTableCell>
                </Hidden>
                <Hidden xsDown>
                  <StyledTableCell>&nbsp;</StyledTableCell>
                </Hidden>
              </TableRow>
            </TableHead>
            <TableBody>
              {map(stocks.items, d => (
                <StockRow data={d} key={d.isin} />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
        {stocks.isFetching && (
          <div
            style={{
              position: 'relative',
              left: '50%',
              transform: 'translate(0%, 0%)',
              width: '100%',
              padding: '20px',
            }}
          >
            <CircularProgress color="secondary" />
          </div>
        )}
      </Paper>
    </Container>
  );
};

StockTable.propTypes = {
  stocks: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
    lastUpdated: PropTypes.number,
  }).isRequired,
  updateStocks: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  updateStocks: () => dispatch(updateStocksAction()),
});

const mapStateToProps = state => {
  const { stocks } = state;

  return {
    stocks,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(StockTable);
