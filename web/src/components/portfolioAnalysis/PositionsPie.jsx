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
  makeStyles,
} from '@material-ui/core';
import PropTypes from 'prop-types';
import React, { useState } from 'react';
import { find, map, sumBy } from 'lodash';
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
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
} from '@material-ui/core/colors';
import { findStock, abbreviateTitle } from '../../selectors/stocks';

const useStyles = makeStyles(theme => ({
  formControl: {
    margin: theme.spacing(1),
    minWidth: 120,
  },
  selectEmpty: {
    marginTop: theme.spacing(2),
  },
}));

const PositionsPie = ({ performance, stocks }) => {
  const classes = useStyles();
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const [mode, setMode] = useState('invested');

  const handleModeChange = event => {
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
  let data = [];
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
        value: Math.max(0, p.end.invested + p.end.value),
      }));
    else if (mode === 'loss')
      data = positions.map(p => ({
        isin: p.isin,
        stock: findStock(stocks, p.isin),
        value: Math.max(0, -1 * (p.end.invested + p.end.value)),
      }));

    data.sort((a, b) => a.value - b.value);
    valueSum = sumBy(data, x => x.value);
  }

  return (
    <Container maxWidth="xl" style={{ padding: '0px' }}>
      <Paper style={{ width: '100%', padding: theme.spacing(1) }}>
        <Grid container style={{ width: '100%' }}>
          <Grid item xs={12}>
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
                      label={x =>
                        x.stock ? abbreviateTitle(x.stock.title) : x.isin
                      }
                      paddingAngle={3}
                    >
                      {data.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={colors[index % colors.length]}
                          stroke={colorsAccent[index % colors.length]}
                          strokeWidth={1.2}
                        />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v, isin) => {
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
          <Grid item xs={9}>
            <FormControl className={classes.formControl}>
              <InputLabel id="mode-select-label">Art</InputLabel>
              <Select
                labelId="mode-select-label"
                id="mode-select"
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

PositionsPie.propTypes = {
  performance: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
  stocks: PropTypes.shape({
    data: PropTypes.arrayOf(PropTypes.object),
    isFetching: PropTypes.bool,
  }).isRequired,
};

export default PositionsPie;
