import React from 'react';
import PropTypes from 'prop-types';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import {
  CircularProgress,
  Container,
  Hidden,
  useMediaQuery,
} from '@material-ui/core';
import { withStyles, useTheme } from '@material-ui/core/styles';

import StockPerformanceRow from './StockPerformanceRow';

const StockPerformanceTable = ({ performance }) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('xs'));
  const lgDown = useMediaQuery(theme.breakpoints.down('lg'));

  const StyledTableCell = withStyles(() => ({
    head: {
      fontWeight: 600,
    },
  }))(TableCell);

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

StockPerformanceTable.propTypes = {
  performance: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
};

export default StockPerformanceTable;
