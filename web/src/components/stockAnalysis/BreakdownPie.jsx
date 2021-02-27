import PropTypes from 'prop-types';
import React from 'react';
import { map, sumBy } from 'lodash';
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
import { useTheme, useMediaQuery } from '@material-ui/core';

const BreakdownPie = ({ breakdown }) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('xs'));

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

  const data = map(breakdown, x => ({
    name: x.nameBreakdown,
    percentage: x.investmentPct,
  }));
  if (data.length === 0) return null;

  const percentageSum = sumBy(data, 'percentage');
  if (percentageSum <= 99)
    data.push({ name: 'Unbekannt', percentage: 100 - percentageSum });
  data.sort((x, y) => y.percentage - x.percentage);

  let threshold = 0.0;
  const count = 20;
  if (data.length > count) threshold = data[count].percentage;

  return (
    <ResponsiveContainer aspect={xsDown ? 5 : 2.8} width="100%">
      <PieChart>
        <Pie
          dataKey="percentage"
          nameKey="name"
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
          label={
            xsDown ? null : x => (x.percentage >= threshold ? x.name : null)
          }
          paddingAngle={3}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={colors[index % colors.length]}
              stroke={colorsAccent[index % colors.length]}
              strokeWidth={1.2}
            />
          ))}
        </Pie>
        <Tooltip formatter={(v, name) => [`${v.toFixed(2)}%`, name]} />
      </PieChart>
    </ResponsiveContainer>
  );
};

BreakdownPie.propTypes = {
  breakdown: PropTypes.arrayOf(PropTypes.object).isRequired,
};

export default BreakdownPie;
