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

import PerformanceRow from './PerformanceRow';

const PerformanceTable = ({ performance }) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('xs'));

  const StyledTableCell = withStyles(() => ({
    head: {
      fontWeight: 600,
    },
  }))(TableCell);

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <Paper>
        <TableContainer>
          <Table size="small" aria-label="performance">
            <TableHead>
              <TableRow>
                <StyledTableCell>Zeitraum</StyledTableCell>
                <Hidden xsDown>
                  <StyledTableCell align="right">Investiert</StyledTableCell>
                </Hidden>
                <StyledTableCell align="right">Wert</StyledTableCell>
                <StyledTableCell align="right">Gewinn</StyledTableCell>
                <StyledTableCell align="right">Zinsfuß</StyledTableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {performance.items !== null && (
                <>
                  {performance.items.map(
                    item =>
                      ['Today', 'WeekToDate'].includes(item.kind) && (
                        <PerformanceRow
                          data={item}
                          key={`${item.kind}-${item.end.date}`}
                        />
                      )
                  )}
                  <TableRow>
                    {Array(xsDown ? 4 : 5)
                      .fill(1)
                      .map((_, i) => (
                        <TableCell key={`filler0-${i.toString()}`}>
                          &nbsp;
                        </TableCell>
                      ))}
                  </TableRow>
                  {performance.items.map(
                    item =>
                      ['Total', 'YearToYear', 'YearToDate'].includes(
                        item.kind
                      ) && (
                        <PerformanceRow
                          data={item}
                          key={`${item.kind}-${item.end.date}`}
                        />
                      )
                  )}
                  <TableRow>
                    {Array(xsDown ? 4 : 5)
                      .fill(1)
                      .map((_, i) => (
                        <TableCell key={`filler1-${i.toString()}`}>
                          &nbsp;
                        </TableCell>
                      ))}
                  </TableRow>
                  {performance.items.map(
                    item =>
                      ['MonthToMonth', 'MonthToDate'].includes(item.kind) && (
                        <PerformanceRow
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

PerformanceTable.propTypes = {
  performance: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
    isFetching: PropTypes.bool,
  }).isRequired,
};

export default PerformanceTable;
