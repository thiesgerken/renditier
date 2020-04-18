import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import {
  Container,
  TableBody,
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Hidden,
  Grid,
} from '@material-ui/core';
import { map } from 'lodash';
import React from 'react';
import { withStyles, useTheme } from '@material-ui/core/styles';
import { push as routerPush } from 'connected-react-router';

import {
  updateStocks as updateStocksAction,
  updatePerformance as updatePerformanceAction,
} from '../actions/api';
import { updateStockPlot as updateStockPlotAction } from '../actions/stockPlot';
import StockRow from '../components/StockRow';
import ProgressPaper from '../components/ProgressPaper';
import StockComparisonPlot from '../components/StockComparisonPlot';

const StyledTableCell = withStyles(() => ({
  head: {
    fontWeight: 600,
  },
}))(TableCell);

const StockTable = ({
  stocks,
  updateStocks,
  stockPlotData,
  updateStockPlotData,
  performance,
  updatePerformance,
  push,
}) => {
  const theme = useTheme();
  updateStocks();
  updatePerformance();

  // TODO: also include some overview analysis of how well the entries perform (not regarding invested money)
  // TODO: also include a checkbox whether we own something of this thing (and ability to hide the others)

  return (
    <Grid container spacing={3}>
      <Hidden xsDown implementation="js">
        <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
          <StockComparisonPlot
            stocks={stocks}
            data={stockPlotData}
            updateData={updateStockPlotData}
            performance={performance}
          />
        </Grid>
      </Hidden>
      <Grid item xs={12} style={{ padding: theme.spacing(1) }}>
        <Container maxWidth="xl" style={{ padding: '0px' }}>
          <ProgressPaper loading={stocks.isFetching}>
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
                  {stocks.data !== null &&
                    map(stocks.data, d => (
                      <StockRow data={d} key={d.isin} push={push} />
                    ))}
                </TableBody>
              </Table>
            </TableContainer>
          </ProgressPaper>
        </Container>
      </Grid>
    </Grid>
  );
};

StockTable.propTypes = {
  performance: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
  updatePerformance: PropTypes.func.isRequired,
  stockPlotData: PropTypes.arrayOf(PropTypes.object).isRequired,
  updateStockPlotData: PropTypes.func.isRequired,
  stocks: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
  updateStocks: PropTypes.func.isRequired,
  push: PropTypes.func.isRequired,
};

const mapDispatchToProps = dispatch => ({
  updateStocks: () => dispatch(updateStocksAction()),
  push: x => dispatch(routerPush(x)),
  updatePerformance: () => dispatch(updatePerformanceAction()),
  updateStockPlotData: (isin, startDate, endDate, source) =>
    dispatch(updateStockPlotAction(isin, startDate, endDate, source)),
});

const mapStateToProps = state => {
  const { stocks, performance, stockPlot } = state;

  return {
    stocks,
    performance,
    stockPlotData: stockPlot.items,
  };
};

export default connect(mapStateToProps, mapDispatchToProps)(StockTable);
