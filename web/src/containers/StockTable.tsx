import { useCallback, useEffect } from 'react';
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

import { fetchPerformance } from '../slices/performance';
import { fetchStocks } from '../slices/stocks';
import { updateStockPlot } from '../slices/stockPlot';
import { useAppDispatch, useAppSelector } from '../store';
import type { DataSourceSelection, IsoDate } from '../types/api';
import StockRow from '../components/StockRow';
import ProgressPaper from '../components/ProgressPaper';
import Hidden from '../components/Hidden';
import StockComparisonPlot from '../components/StockComparisonPlot';

const StyledTableCell = styled(TableCell)({
  '&.MuiTableCell-head': {
    fontWeight: 600,
  },
});

const StockTable = () => {
  const navigate = useNavigate();
  const theme = useTheme();
  const dispatch = useAppDispatch();
  const stocks = useAppSelector(state => state.stocks);
  const performance = useAppSelector(state => state.performance);
  const stockPlotData = useAppSelector(state => state.stockPlot.items);
  const updateStockPlotData = useCallback(
    (
      isin: string | null,
      startDate: IsoDate | null,
      endDate: IsoDate | null,
      source: DataSourceSelection | null
    ) => dispatch(updateStockPlot(isin, startDate, endDate, source)),
    [dispatch]
  );

  useEffect(() => {
    dispatch(fetchStocks());
    dispatch(fetchPerformance());
  });

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

export default StockTable;
