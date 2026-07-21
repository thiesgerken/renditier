import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import { CircularProgress, Container, useMediaQuery } from '@mui/material';
import { styled, useTheme } from '@mui/material/styles';

import StockPerformanceRow from './StockPerformanceRow';
import type { StockPerformancePeriod } from './StockPerformanceRow';
import Hidden from '../Hidden';
import type { ResourceState } from '../../types/store';

interface Props {
  // The performance slice, with its portfolio-wide periods replaced by the
  // single position's periods (see containers/StockAnalysis).
  performance: ResourceState<StockPerformancePeriod[]>;
}

const StyledTableCell = styled(TableCell)({
  '&.MuiTableCell-head': {
    fontWeight: 600,
  },
});

const StockPerformanceTable = ({ performance }: Props) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));
  const lgDown = useMediaQuery(theme.breakpoints.down('lg'));

  let cols = 7;
  if (lgDown) cols = 6;
  if (xsDown) cols = 4;

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <Paper>
        <TableContainer>
          <Table size="small" aria-label="performance">
            <TableHead>
              <TableRow>
                <StyledTableCell>Zeitraum</StyledTableCell>
                <StyledTableCell align="right">Kurs</StyledTableCell>
                <Hidden lgDown>
                  <StyledTableCell align="right">Einheiten</StyledTableCell>
                </Hidden>
                <Hidden xsDown>
                  <StyledTableCell align="right">Investiert</StyledTableCell>
                </Hidden>
                <StyledTableCell align="right">Wert</StyledTableCell>
                <StyledTableCell align="right">Gewinn</StyledTableCell>
                <Hidden xsDown>
                  <StyledTableCell align="right">Zinsfuß</StyledTableCell>
                </Hidden>
              </TableRow>
            </TableHead>
            <TableBody>
              {performance.data !== null && (
                <>
                  {performance.data.map(
                    item =>
                      ['Today', 'WeekToDate'].includes(item.kind) && (
                        <StockPerformanceRow
                          data={item}
                          key={`${item.kind}-${item.end.date}`}
                        />
                      )
                  )}
                  <TableRow>
                    {Array(cols)
                      .fill(1)
                      .map((_, i) => (
                        <TableCell key={`filler0-${i.toString()}`}>
                          &nbsp;
                        </TableCell>
                      ))}
                  </TableRow>
                  {performance.data.map(
                    item =>
                      ['Total', 'YearToYear', 'YearToDate'].includes(
                        item.kind
                      ) && (
                        <StockPerformanceRow
                          data={item}
                          key={`${item.kind}-${item.end.date}`}
                        />
                      )
                  )}
                  <TableRow>
                    {Array(cols)
                      .fill(1)
                      .map((_, i) => (
                        <TableCell key={`filler1-${i.toString()}`}>
                          &nbsp;
                        </TableCell>
                      ))}
                  </TableRow>
                  {performance.data.map(
                    item =>
                      ['MonthToMonth', 'MonthToDate'].includes(item.kind) && (
                        <StockPerformanceRow
                          data={item}
                          key={`${item.kind}-${item.end.date}`}
                        />
                      )
                  )}
                </>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {performance.isFetching && (
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

export default StockPerformanceTable;
