import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import {
  Container,
  Grid,
  MenuItem,
  InputLabel,
  Select,
  FormControl,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { map } from 'lodash';

import PositionRow from './PositionRow';
import { getPeriodDescription } from '../../selectors/performance';
import { findStock } from '../../selectors/stocks';
import ProgressPaper from '../ProgressPaper';
import Hidden from '../Hidden';

const formControlSx = { m: 1, minWidth: 120 };

const StyledTableCell = styled(TableCell)({
  '&.MuiTableCell-head': {
    fontWeight: 600,
  },
});

const PositionsTable = ({ performance, stocks, push }) => {
  const [period, setPeriod] = useState(0);

  const handlePeriodChange = event => {
    setPeriod(event.target.value);
  };

  const tp =
    performance.data === null || period >= performance.data.length
      ? undefined
      : performance.data[period];

  const positions =
    tp === undefined
      ? []
      : map(tp.positions, (item, isin) => ({ ...item, isin }));
  positions.sort((a, b) => a.end.invested - b.end.invested);

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper loading={performance.isFetching}>
        <Grid container style={{ width: '100%' }}>
          <Grid item xs={12}>
            <TableContainer>
              <Table size="small" aria-label="positions">
                <TableHead>
                  <TableRow>
                    <Hidden lgDown>
                      <StyledTableCell>ISIN</StyledTableCell>
                    </Hidden>
                    <StyledTableCell>Name</StyledTableCell>
                    <Hidden xsDown>
                      <StyledTableCell align="right">Einheiten</StyledTableCell>
                    </Hidden>
                    <Hidden xsDown>
                      <StyledTableCell align="right">Kurs</StyledTableCell>
                      <StyledTableCell align="right">
                        Investiert
                      </StyledTableCell>
                    </Hidden>
                    <StyledTableCell align="right">Wert</StyledTableCell>
                    <StyledTableCell align="right">Gewinn</StyledTableCell>
                    <StyledTableCell align="right">Zinsfuß</StyledTableCell>
                    <Hidden lgDown>
                      <StyledTableCell align="right">&nbsp;</StyledTableCell>
                    </Hidden>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {map(
                    positions,
                    d =>
                      d.units !== 0 && (
                        <PositionRow
                          data={d}
                          key={d.isin}
                          push={push}
                          stock={findStock(stocks, d.isin)}
                        />
                      )
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Grid>
          <Grid item xs={9}>
            <FormControl sx={formControlSx}>
              <InputLabel id="period-select-label">Zeit</InputLabel>
              <Select
                labelId="period-select-label"
                id="period-select"
                autoWidth
                value={
                  performance.data === null || performance.data.length === 0
                    ? ''
                    : period
                }
                onChange={handlePeriodChange}
              >
                {performance.data !== null &&
                  performance.data.map((item, i) => (
                    <MenuItem value={i} key={i}>
                      {getPeriodDescription(item)}
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </ProgressPaper>
    </Container>
  );
};

PositionsTable.propTypes = {
  performance: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.shape({})),
    isFetching: PropTypes.bool,
  }).isRequired,
  stocks: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.shape({})),
    isFetching: PropTypes.bool,
  }).isRequired,
  push: PropTypes.func.isRequired,
};

export default PositionsTable;
