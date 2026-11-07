import { map, sumBy, unescape } from 'lodash';
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

import type { StockHolding } from '../../types/api';
import { formatPercent } from '../../format';

interface Props {
  holdings: StockHolding[];
}

// The synthetic "Unbekannt" / "Sonstige" slices carry no `instrument`, so the
// plotted entries are wider than the holdings that come out of the API.
interface HoldingsDatum {
  instrument?: StockHolding['instrument'];
  investmentPct: number;
  name: string;
}

// Pie spreads every key of a data entry into the label render props, so our own
// `investmentPct` key exists at runtime but is absent from recharts' type.
type HoldingsLabelProps = PieLabelRenderProps & { investmentPct: number };

const HoldingsPie = ({ holdings }: Props) => {
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

  const data: HoldingsDatum[] = map(holdings, h => ({
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
            // recharts types "no label" as `false`; the original passed `null`,
            // which it treats identically but does not declare.
            xsDown
              ? false
              : (x: PieLabelRenderProps) =>
                  (x as HoldingsLabelProps).investmentPct >= labelThreshold
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
        {/* `investmentPct` is this chart's only dataKey, so the value is a number. */}
        <Tooltip
          formatter={(v, name) => [formatPercent((v as number) / 100), name]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
};

export default HoldingsPie;
