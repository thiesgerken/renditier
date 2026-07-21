import {
  CircularProgress,
  Container,
  Paper,
  useMediaQuery,
  useTheme,
  Grid,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material';
import { useState } from 'react';
import { find, map, sumBy } from 'lodash';
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import type { PieLabelRenderProps, TooltipValueType } from 'recharts';
import {
  red,
  blue,
  deepOrange,
  teal,
  pink,
  lime,
  green,
  deepPurple,
  orange,
} from '@mui/material/colors';

import type { Stock } from '../../types/api';
import type { PerformanceState, StocksState } from '../../types/store';
import { findStock, abbreviateTitle } from '../../selectors/stocks';

const formControlSx = { m: 1, minWidth: 120 };

// One slice of the pie; `value` keeps the API's nullability.
interface PieDatum {
  isin: string;
  stock: Stock | null;
  value: number | null;
}

interface Props {
  performance: PerformanceState;
  stocks: StocksState;
}

const PositionsPie = ({ performance, stocks }: Props) => {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [mode, setMode] = useState('invested');

  const handleModeChange = (event: SelectChangeEvent<string>) => {
    setMode(event.target.value);
  };

  const colorNames = [
    teal,
    deepOrange,
    blue,
    orange,
    pink,
    green,
    lime,
    deepPurple,
    red,
  ];
  const colors = colorNames.map(c => c[400]);
  const colorsAccent = colorNames.map(c => c['500']);

  const progress = performance.isFetching && (
    <div
      style={{
        position: 'relative',
        zIndex: 9,
        left: '50%',
        top: '40%',
        transform: 'translate(0%, -50%)',
        width: '100%',
        height: 0,
      }}
    >
      <CircularProgress color="secondary" />
    </div>
  );

  const tp =
    performance.data === null
      ? undefined
      : find(performance.data, p => p.kind === 'Total');
  let data: PieDatum[] = [];
  let valueSum = 0;

  if (tp !== undefined) {
    const positions = map(tp.positions, (item, isin) => ({ ...item, isin }));

    if (mode === 'invested')
      data = positions.map(p => ({
        isin: p.isin,
        stock: findStock(stocks, p.isin),
        value: -1 * p.end.invested,
      }));
    else if (mode === 'value')
      data = positions.map(p => ({
        isin: p.isin,
        stock: findStock(stocks, p.isin),
        value: p.end.value,
      }));
    else if (mode === 'profit')
      data = positions.map(p => ({
        isin: p.isin,
        stock: findStock(stocks, p.isin),
        // `end.value` is `number | null`; `?? 0` reproduces the coercion the
        // original relied on when JS added `null` into the sum.
        value: Math.max(0, p.end.invested + (p.end.value ?? 0)),
      }));
    else if (mode === 'loss')
      data = positions.map(p => ({
        isin: p.isin,
        stock: findStock(stocks, p.isin),
        value: Math.max(0, -1 * (p.end.invested + (p.end.value ?? 0))),
      }));

    data.sort((a, b) => (a.value ?? 0) - (b.value ?? 0));
    valueSum = sumBy(data, x => x.value ?? 0);
  }

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <Paper style={{ width: '100%', padding: theme.spacing(1) }}>
        <Grid container style={{ width: '100%' }}>
          <Grid size={12}>
            <div
              style={{ position: 'relative', width: '100%', height: '100%' }}
            >
              {progress}
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                }}
              >
                <ResponsiveContainer aspect={mdUp ? 5 : 3} width="100%">
                  <PieChart>
                    <Pie
                      dataKey="value"
                      nameKey="isin"
                      animationDuration={500}
                      animationBegin={100}
                      // NOTE: sometimes the end result does not render?
                      isAnimationActive={false}
                      data={data}
                      cx="50%"
                      cy="50%"
                      innerRadius="40%"
                      outerRadius="80%"
                      fill="#8884d8"
                      label={(props: PieLabelRenderProps) => {
                        // recharts spreads each datum into the label render
                        // props but cannot express that in its types
                        // (recharts#6380); here the datum is a PieDatum.
                        const x = props as PieLabelRenderProps & PieDatum;
                        return x.stock
                          ? abbreviateTitle(x.stock.title)
                          : x.isin;
                      }}
                      paddingAngle={3}
                    >
                      {data.map((_entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={colors[index % colors.length]}
                          stroke={colorsAccent[index % colors.length]}
                          strokeWidth={1.2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(
                        value: TooltipValueType | undefined,
                        name: number | string | undefined
                      ) => {
                        // nameKey is "isin", so `name` is the ISIN string and
                        // `value` the numeric `value` of the datum.
                        const isin = String(name ?? '');
                        const v = value as number;
                        const stock = findStock(stocks, isin);
                        const percentage =
                          valueSum !== 0.0
                            ? ` (${((v / valueSum) * 100).toFixed(1)}%)`
                            : '';

                        return [
                          `${v.toFixed(2)}€${percentage}`,
                          stock ? stock.title : isin,
                        ];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </Grid>
          <Grid size={9}>
            <FormControl sx={formControlSx} variant="standard">
              <InputLabel id="mode-select-label">Art</InputLabel>
              <Select
                labelId="mode-select-label"
                id="mode-select"
                label="Art"
                value={mode}
                autoWidth
                onChange={handleModeChange}
              >
                <MenuItem value="invested">Kaufpreis</MenuItem>
                <MenuItem value="value">Wert</MenuItem>
                <MenuItem value="profit">Gewinn</MenuItem>
                <MenuItem value="loss">Verlust</MenuItem>
              </Select>
            </FormControl>
          </Grid>
        </Grid>
      </Paper>
    </Container>
  );
};

export default PositionsPie;
