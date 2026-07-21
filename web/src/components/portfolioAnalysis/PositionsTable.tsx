import { useState } from 'react';
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
import type { SelectChangeEvent } from '@mui/material';
import { styled } from '@mui/material/styles';
import { map } from 'lodash';

import type { PerformanceState, StocksState } from '../../types/store';
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

interface Props {
  performance: PerformanceState;
  stocks: StocksState;
  push: (path: string) => void;
}

const PositionsTable = ({ performance, stocks, push }: Props) => {
  const [period, setPeriod] = useState(0);

  const handlePeriodChange = (event: SelectChangeEvent<number | ''>) => {
    // The `''` value is only used while there is no performance data, in which
    // case the Select renders no items and cannot fire a change.
    setPeriod(event.target.value as number);
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
          <Grid size={12}>
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
                      // FIXME(tsx-migration): this read `d.units`, which does not
                      // exist on PositionPerformance (only the snapshots carry
                      // `units`), so the guard was always true and closed-out
                      // positions were still rendered. Reads `d.end.units` now.
                      d.end.units !== 0 && (
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
          <Grid size={9}>
            <FormControl sx={formControlSx} variant="standard">
              <InputLabel id="period-select-label">Zeit</InputLabel>
              <Select
                labelId="period-select-label"
                id="period-select"
                label="Zeit"
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

export default PositionsTable;
