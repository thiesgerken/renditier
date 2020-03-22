import React from 'react';
import PropTypes from 'prop-types';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableContainer from '@material-ui/core/TableContainer';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { CircularProgress, Container, Hidden } from '@material-ui/core';
import { withStyles } from '@material-ui/core/styles';
import { find, map } from 'lodash';

import PositionRow from './PositionRow';

// TODO: Footer with totals
// TODO: combobox to select timespan; show vorher/nachher columns only if needed (start !== null)

const PositionsTable = ({ performance }) => {
  const StyledTableCell = withStyles(() => ({
    head: {
      fontWeight: 600,
    },
  }))(TableCell);

  const tp =
    performance.items === null
      ? undefined
      : find(performance.items, p => p.kind === 'Total');
  if (tp !== undefined) {
    const positions = map(tp.positions, (item, isin) => ({ ...item, isin }));
    positions.sort((a, b) => a.end.invested - b.end.invested);

    return (
      <Container maxWidth="xl" style={{ padding: '0px' }}>
        <Paper>
          <TableContainer>
            <Table size="small" aria-label="positions">
              <TableHead>
                <TableRow>
                  <StyledTableCell>ISIN</StyledTableCell>
                  <Hidden xsDown>
                    <StyledTableCell align="right">Einheiten</StyledTableCell>
                    <StyledTableCell align="right">Kurs</StyledTableCell>
                    <StyledTableCell align="right">Investiert</StyledTableCell>
                  </Hidden>
                  <StyledTableCell align="right">Wert</StyledTableCell>
                  <StyledTableCell align="right">Gewinn</StyledTableCell>
                  <StyledTableCell align="right">Zinsfuß</StyledTableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {map(
                  positions,
                  d => d.units !== 0 && <PositionRow data={d} key={d.isin} />
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </Paper>
      </Container>
    );
  }

  if (performance.isFetching) {
    return (
      <Paper style={{ width: '100%', height: 300 }}>
        <div
          style={{
            position: 'relative',
            left: '50%',
            top: '50%',
            transform: 'translate(0%, -50%)',
            width: '100%',
          }}
        >
          <CircularProgress color="secondary" />
        </div>
      </Paper>
    );
  }

  return <></>;
};

PositionsTable.propTypes = {
  performance: PropTypes.shape({
    items: PropTypes.arrayOf(PropTypes.object),
    lastUpdated: PropTypes.number,
    isFetching: PropTypes.bool,
  }).isRequired,
};

export default PositionsTable;
