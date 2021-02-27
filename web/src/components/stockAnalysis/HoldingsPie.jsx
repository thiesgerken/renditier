import PropTypes from 'prop-types';
import React from 'react';
import { map, sumBy, unescape } from 'lodash';
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

const HoldingsPie = ({ holdings }) => {
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

  const data = map(holdings, h => ({
    ...h,
    name: unescape(h.instrument.name).replace('/The', ''),
  }));

  if (data.length === 0) return null;

  let shareSum = sumBy(data, 'investmentPct');
  if (shareSum <= 99)
    data.push({ name: 'Unbekannt', investmentPct: 100 - shareSum });
  data.sort((x, y) => y.investmentPct - x.investmentPct);

  let labelThreshold = 0.0;
  const labelCount = 20;
  if (data.length > labelCount) {
    labelThreshold = data[labelCount].investmentPct;
  }

  const displayCount = 20;
  if (data.length > displayCount) {
    data.splice(displayCount);
    shareSum = sumBy(data, 'investmentPct');
    data.push({ name: 'Sonstige', investmentPct: 100 - shareSum });
  }

  return (
    <ResponsiveContainer aspect={xsDown ? 5 : 2.8} width="100%">
      <PieChart>
        <Pie
          dataKey="investmentPct"
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
            xsDown
              ? null
              : x => (x.investmentPct >= labelThreshold ? x.name : null)
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

HoldingsPie.propTypes = {
  holdings: PropTypes.arrayOf(
    PropTypes.shape({ name: PropTypes.string, share: PropTypes.number })
  ).isRequired,
};

export default HoldingsPie;
