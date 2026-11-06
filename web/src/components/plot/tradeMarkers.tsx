import type { Theme } from '@mui/material';
import { Line } from 'recharts';
import type { DotItemDotProps } from 'recharts';

import { formatCurrency, formatNumber } from '../../format';
import type { Trades } from './trades';
import type { TooltipRow } from './PlotTooltip';

export const TRADES_AXIS = 'trades';

type Direction = 'up' | 'down';

const SIZE = 7;

// A small triangle at the bottom edge of the plot; sells sit one row above
// buys so that both stay visible on days with both.
const triangle =
  (direction: Direction, color: string) =>
  ({ cx, cy, value, index }: DotItemDotProps) => {
    if (value === null || cx === undefined || cy === undefined) return null;

    const base = direction === 'up' ? cy - 2 : cy - 2 * SIZE - 3;
    const path =
      direction === 'up'
        ? `M${cx - SIZE / 2},${base} h${SIZE} l${-SIZE / 2},${-SIZE} z`
        : `M${cx - SIZE / 2},${base} h${SIZE} l${-SIZE / 2},${SIZE} z`;

    return <path key={index} d={path} fill={color} fillOpacity={0.75} />;
  };

const markerLine = (
  key: string,
  hasTrade: (trades: Trades) => boolean,
  direction: Direction,
  color: string
) => (
  <Line
    key={key}
    yAxisId={TRADES_AXIS}
    dataKey={(p: { trades: Trades | null }) =>
      p.trades !== null && hasTrade(p.trades) ? 0 : null
    }
    stroke="none"
    dot={triangle(direction, color)}
    activeDot={false}
    isAnimationActive={false}
    legendType="none"
  />
);

// Buy and sell markers; the chart needs a hidden YAxis with id `TRADES_AXIS`
// and domain [0, 1].
export const tradeMarkers = (theme: Theme) => [
  markerLine('buys', t => t.boughtUnits > 0, 'up', theme.palette.primary.main),
  markerLine(
    'sells',
    t => t.soldUnits > 0,
    'down',
    theme.palette.secondary.main
  ),
];

export const tradeRows = (
  trades: Trades | null,
  withUnits: boolean
): TooltipRow[] => {
  if (trades === null) return [];

  const describe = (units: number, amount: number) =>
    withUnits
      ? `${formatNumber(units, { digits: 3 })} für ${formatCurrency(amount)}`
      : formatCurrency(amount);

  return [
    ...(trades.boughtUnits > 0
      ? [
          {
            label: 'Kauf',
            value: describe(trades.boughtUnits, trades.boughtAmount),
          },
        ]
      : []),
    ...(trades.soldUnits > 0
      ? [
          {
            label: 'Verkauf',
            value: describe(trades.soldUnits, trades.soldAmount),
          },
        ]
      : []),
  ];
};
