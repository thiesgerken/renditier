// Chart elements shared by all time series plots. These are functions rather
// than components because recharts only recognizes its own elements as direct
// children of a chart.
import { Area, Tooltip, XAxis } from 'recharts';

import { formatPointDate, timeAxis } from './axes';
import PlotTooltip from './PlotTooltip';
import type { TooltipRow } from './PlotTooltip';
import type { SchemePalette } from '../../muiTheme';

// X axis over the `epoch` of the points.
export const timeXAxis = (epochs: number[]) => {
  const axis =
    epochs.length > 0
      ? timeAxis(epochs[0], epochs[epochs.length - 1])
      : timeAxis(0, 0);

  return (
    <XAxis
      dataKey="epoch"
      type="number"
      scale="time"
      domain={['dataMin', 'dataMax']}
      ticks={axis.ticks}
      tickFormatter={axis.format}
      interval="equidistantPreserveStart"
    />
  );
};

// Tooltip listing `rows` of the hovered point, titled with its date.
export const pointTooltip = <P extends { epoch: number }>(
  intraday: boolean,
  rows: (point: P) => TooltipRow[]
) => (
  <Tooltip
    content={({ active, payload }) => {
      const point = payload?.[0]?.payload as P | undefined;
      if (!active || point === undefined) return null;

      return (
        <PlotTooltip
          title={formatPointDate(point.epoch, intraday)}
          rows={rows(point)}
        />
      );
    }}
  />
);

// Where a series crosses zero, as a fraction of the plot height from the top.
const zeroOffset = (values: (number | null)[]): number => {
  const present = values.filter((v): v is number => v !== null);
  const max = Math.max(...present);
  const min = Math.min(...present);

  if (max <= 0) return 0;
  if (min >= 0) return 1;
  return max / (max - min);
};

// An area colored by sign: primary above zero, secondary below.
export const signedArea = (
  dataKey: string,
  name: string,
  values: (number | null)[],
  type: 'linear' | 'stepAfter',
  palette: SchemePalette
) => {
  const offset = zeroOffset(values);

  return [
    <defs key={`${dataKey}Gradients`}>
      <linearGradient id={`${dataKey}Stroke`} x1="0" y1="0" x2="0" y2="1">
        <stop offset={offset} stopColor={palette.primary.dark} />
        <stop offset={offset} stopColor={palette.secondary.dark} />
      </linearGradient>
      <linearGradient id={`${dataKey}Fill`} x1="0" y1="0" x2="0" y2="1">
        <stop offset={offset} stopColor={palette.primary.main} />
        <stop offset={offset} stopColor={palette.secondary.main} />
      </linearGradient>
    </defs>,
    <Area
      key={dataKey}
      type={type}
      dataKey={dataKey}
      name={name}
      stroke={`url(#${dataKey}Stroke)`}
      fill={`url(#${dataKey}Fill)`}
      fillOpacity={0.2}
      strokeWidth={1.4}
      dot={false}
      isAnimationActive={false}
    />,
  ];
};
