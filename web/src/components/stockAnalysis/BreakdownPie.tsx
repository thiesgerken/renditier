import { map, sumBy } from 'lodash';
import { ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from 'recharts';
import type { PieLabelRenderProps } from 'recharts';
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
import { useTheme, useMediaQuery } from '@mui/material';

import type { StockBreakdownEntry } from '../../types/api';

interface Props {
  breakdown: StockBreakdownEntry[];
}

// Pie spreads every key of a data entry into the label render props, so our own
// `percentage` key exists at runtime but is absent from recharts' type.
type BreakdownLabelProps = PieLabelRenderProps & { percentage: number };

const BreakdownPie = ({ breakdown }: Props) => {
  const theme = useTheme();
  const xsDown = useMediaQuery(theme.breakpoints.down('sm'));

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
            // recharts types "no label" as `false`; the original passed `null`,
            // which it treats identically but does not declare.
            xsDown
              ? false
              : (x: PieLabelRenderProps) =>
                  (x as BreakdownLabelProps).percentage >= threshold
                    ? x.name
                    : null
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
        {/* `percentage` is this chart's only dataKey, so the value is a number. */}
        <Tooltip
          formatter={(v, name) => [`${(v as number).toFixed(2)}%`, name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default BreakdownPie;
