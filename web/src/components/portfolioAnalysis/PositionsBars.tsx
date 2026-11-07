import {
  Container,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useState } from 'react';
import { find, map } from 'lodash';

import type { PositionPerformance } from '../../types/api';
import type { PerformanceState, StocksState } from '../../types/store';
import { findStock, abbreviateTitle } from '../../selectors/stocks';
import { formatCurrency } from '../../format';
import ProgressPaper from '../ProgressPaper';
import BarList from '../BarList';
import type { BarItem } from '../BarList';

// Same threshold as the backend uses for "no units left".
const isHeld = (p: PositionPerformance) => Math.abs(p.end.units) > 1e-8;

const profit = (p: PositionPerformance) =>
  p.end.value === null ? null : p.end.invested + p.end.value;

// The amount of a position per mode; null when it is unknown because the
// position has no price. Sold positions are no part of what is invested or
// held, but their realized profit or loss counts.
const MODES = {
  invested: {
    label: 'Kaufpreis',
    amount: (p: PositionPerformance) => (isHeld(p) ? -p.end.invested : 0),
  },
  value: {
    label: 'Wert',
    amount: (p: PositionPerformance) => p.end.value,
  },
  profit: {
    label: 'Gewinn',
    amount: (p: PositionPerformance) => {
      const x = profit(p);
      return x === null ? null : Math.max(0, x);
    },
  },
  loss: {
    label: 'Verlust',
    amount: (p: PositionPerformance) => {
      const x = profit(p);
      return x === null ? null : Math.max(0, -x);
    },
  },
};

type Mode = keyof typeof MODES;

// The dashboard has the full positions table right above, so this list is
// about proportions: ten rows cover nearly all of a typical portfolio.
const MAX_ROWS = 10;

interface Props {
  performance: PerformanceState;
  stocks: StocksState;
}

const PositionsBars = ({ performance, stocks }: Props) => {
  const [mode, setMode] = useState<Mode>('invested');

  const handleModeChange = (event: SelectChangeEvent<Mode>) => {
    setMode(event.target.value);
  };

  const total = find(performance.data, p => p.kind === 'Total');
  const positions =
    total === undefined
      ? []
      : map(total.positions, (p, isin) => {
          const stock = findStock(stocks, isin);
          return {
            label: stock === null ? isin : abbreviateTitle(stock.title),
            title: stock === null ? isin : stock.title,
            amount: MODES[mode].amount(p),
          };
        });

  const items: BarItem[] = positions.flatMap(p =>
    p.amount === null
      ? []
      : [{ label: p.label, title: p.title, value: p.amount }]
  );
  const unpriced = positions.filter(p => p.amount === null);

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <ProgressPaper loading={performance.isFetching}>
        <BarList
          title={`Positionen nach ${MODES[mode].label}`}
          items={items}
          maxRows={MAX_ROWS}
          formatValue={v => formatCurrency(v, { digits: 0 })}
          note={
            unpriced.length > 0
              ? `Ohne Kurs, daher nicht enthalten: ${unpriced
                  .map(p => p.label)
                  .join(', ')}`
              : undefined
          }
        />
        <FormControl sx={{ m: 1, minWidth: 120 }} variant="standard">
          <InputLabel id="positions-mode-label">Art</InputLabel>
          <Select
            labelId="positions-mode-label"
            id="positions-mode"
            label="Art"
            value={mode}
            autoWidth
            onChange={handleModeChange}
          >
            {Object.entries(MODES).map(([value, { label }]) => (
              <MenuItem key={value} value={value}>
                {label}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </ProgressPaper>
    </Container>
  );
};

export default PositionsBars;
