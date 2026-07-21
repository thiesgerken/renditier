import { connect } from 'react-redux';
import type { ConnectedProps } from 'react-redux';
import {
  Container,
  TableBody,
  Table,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Grid,
} from '@mui/material';
import { map } from 'lodash';
import { styled, useTheme } from '@mui/material/styles';
import { useNavigate } from 'react-router-dom';

import {
  updateStocks as updateStocksAction,
  updatePerformance as updatePerformanceAction,
} from '../actions/api';
import { updateStockPlot as updateStockPlotAction } from '../actions/stockPlot';
import type { AppDispatch } from '../types/actions';
import type { DataSourceSelection, IsoDate } from '../types/api';
import type { RootState } from '../types/store';
import StockRow from '../components/StockRow';
import ProgressPaper from '../components/ProgressPaper';
import Hidden from '../components/Hidden';
import StockComparisonPlot from '../components/StockComparisonPlot';

const StyledTableCell = styled(TableCell)({
  '&.MuiTableCell-head': {
    fontWeight: 600,
  },
});

const StockTable = ({
  stocks,
  updateStocks,
  stockPlotData,
  updateStockPlotData,
  performance,
  updatePerformance,
}: Props) => {
  const navigate = useNavigate();
  const theme = useTheme();
  updateStocks();
  updatePerformance();

  // TODO: also include some overview analysis of how well the entries perform (not regarding invested money)
  // TODO: also include a checkbox whether we own something of this thing (and ability to hide the others)

  return (
    <Grid container spacing={3}>
      {/* FIXME(tsx-migration): dropped `implementation="js"` — a MUI v4 leftover
          that the converted Hidden component does not accept. */}
      <Hidden xsDown>
        <Grid size={12} style={{ padding: theme.spacing(1) }}>
          <StockComparisonPlot
            stocks={stocks}
            data={stockPlotData}
            updateData={updateStockPlotData}
            performance={performance}
          />
        </Grid>
      </Hidden>
      <Grid size={12} style={{ padding: theme.spacing(1) }}>
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
                      <StockRow data={d} key={d.isin} push={navigate} />
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

const mapDispatchToProps = (dispatch: AppDispatch) => ({
  updateStocks: () => dispatch(updateStocksAction()),
  updatePerformance: () => dispatch(updatePerformanceAction()),
  updateStockPlotData: (
    isin: string | null,
    startDate: IsoDate | null,
    endDate: IsoDate | null,
    source: DataSourceSelection | null
  ) => dispatch(updateStockPlotAction(isin, startDate, endDate, source)),
});

const mapStateToProps = (state: RootState) => {
  const { stocks, performance, stockPlot } = state;

  return {
    stocks,
    performance,
    stockPlotData: stockPlot.items,
  };
};

const connector = connect(mapStateToProps, mapDispatchToProps);

type Props = ConnectedProps<typeof connector>;

export default connector(StockTable);
