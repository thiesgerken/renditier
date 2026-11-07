import type { CSSProperties, ReactNode } from 'react';
import { cn } from 'cn';
import {
  CalendarRange,
  ChartCandlestick,
  Hash,
  Percent,
  PiggyBank,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { PortfolioSnapshot, PositionSnapshot } from '../types/api';
import { getPrice } from '../selectors/performance';
import { formatChange, formatPriceSource } from '../format';
import type { IrrPeriod } from '../format';
import useTableFormat from './useTableFormat';
import { TableCell, TableHead } from './ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

// The columns that the performance tables of the portfolio, its positions and
// a single stock share. Their cells show the value at the end of the period,
// and its change over the period below it.

const COLUMNS = {
  period: { label: 'Zeitraum', icon: CalendarRange },
  price: { label: 'Kurs', icon: ChartCandlestick },
  units: { label: 'Einheiten', icon: Hash },
  invested: { label: 'Investiert', icon: PiggyBank },
  value: { label: 'Wert', icon: Wallet },
  profit: { label: 'Gewinn', icon: TrendingUp },
  irr: { label: 'Zinsfuß', icon: Percent },
} satisfies Record<string, { label: string; icon: LucideIcon }>;

interface ColumnHeadProps {
  column: keyof typeof COLUMNS;
  className?: string;
}

// Phones have no room for the icons.
export const ColumnHead = ({ column, className }: ColumnHeadProps) => {
  const { label, icon: Icon } = COLUMNS[column];

  return (
    <TableHead className={cn(column !== 'period' && 'text-right', className)}>
      <span className="inline-flex items-center gap-1.5">
        <Icon className="hidden size-4 text-muted-foreground md:block" />
        {label}
      </span>
    </TableHead>
  );
};

interface Period {
  start: PortfolioSnapshot;
  end: PortfolioSnapshot;
}

interface PositionPeriod {
  start: PositionSnapshot;
  end: PositionSnapshot;
}

interface ValueWithChangeProps {
  value: string;
  // see formatChange; nothing is shown below the value when it is null
  change: string | null;
  // e.g. signColor for a gain or loss; without it, the change is neutral
  // because its direction is neither good nor bad (more units, more invested)
  changeStyle?: CSSProperties;
}

// A table value with its change over the period below it, smaller. Neither
// line wraps, so that a cell never takes more than these two lines.
const ValueWithChange = ({
  value,
  change,
  changeStyle,
}: ValueWithChangeProps) => (
  <div className="whitespace-nowrap">
    {value}
    {change !== null && (
      <div className="text-xs text-muted-foreground" style={changeStyle}>
        {change}
      </div>
    )}
  </div>
);

// Numbers are right-aligned, with digits of equal width so that they line up.
const NumberCell = ({
  children,
  className,
  style,
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) => (
  <TableCell className={cn('text-right tabular-nums', className)} style={style}>
    {children}
  </TableCell>
);

const WithInfo = ({
  info,
  children,
}: {
  info: ReactNode;
  children: ReactNode;
}) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <div>{children}</div>
    </TooltipTrigger>
    <TooltipContent className="block">{info}</TooltipContent>
  </Tooltip>
);

interface CellProps<P> {
  period: P;
  // e.g. to hide the column on small screens
  className?: string;
}

const difference = (start: number | null, end: number | null) =>
  start === null || end === null ? null : end - start;

export const PriceCell = ({ period, className }: CellProps<PositionPeriod>) => {
  const { money, percent, ratioColor } = useTableFormat();
  const start = getPrice(period.start.dataSource);
  const end = getPrice(period.end.dataSource);
  const ratio = start === null || end === null ? null : (end - start) / start;

  const sources = (
    <>
      {formatPriceSource(period.start.dataSource)}
      {period.start.dataSource !== null && period.end.dataSource !== null && (
        <br />
      )}
      {formatPriceSource(period.end.dataSource)}
    </>
  );

  return (
    <NumberCell className={className}>
      <WithInfo info={sources}>
        <ValueWithChange
          value={money(end)}
          change={formatChange(start, end, money, percent)}
          changeStyle={ratioColor(ratio)}
        />
      </WithInfo>
    </NumberCell>
  );
};

export const UnitsCell = ({ period, className }: CellProps<PositionPeriod>) => {
  const { units } = useTableFormat();

  return (
    <NumberCell className={className}>
      <ValueWithChange
        value={units(period.end.units)}
        change={formatChange(period.start.units, period.end.units, units)}
      />
    </NumberCell>
  );
};

export const InvestedCell = ({ period, className }: CellProps<Period>) => {
  const { money } = useTableFormat();
  const { start, end } = period;

  const line = (label: string, startValue: number, endValue: number) => {
    const change = formatChange(startValue, endValue, money);
    return `${label}: ${money(endValue)}${change === null ? '' : ` (${change})`}`;
  };

  const feesInfo = (
    <>
      {line('davon Gebühren', -start.fees, -end.fees)}
      <br />
      {line(
        'ohne Gebühren',
        -start.invested + start.fees,
        -end.invested + end.fees
      )}
    </>
  );

  return (
    <NumberCell className={className}>
      <WithInfo info={feesInfo}>
        <ValueWithChange
          value={money(-end.invested)}
          change={formatChange(-start.invested, -end.invested, money)}
        />
      </WithInfo>
    </NumberCell>
  );
};

// The change of the value includes what was invested or taken out, so it is
// no gain or loss and stays neutral.
export const ValueCell = ({ period, className }: CellProps<Period>) => {
  const { money } = useTableFormat();

  return (
    <NumberCell className={className}>
      <ValueWithChange
        value={money(period.end.value)}
        change={formatChange(period.start.value, period.end.value, money)}
      />
    </NumberCell>
  );
};

const profit = (snapshot: PortfolioSnapshot) =>
  snapshot.value === null ? null : snapshot.value + snapshot.invested;

export const ProfitCell = ({ period, className }: CellProps<Period>) => {
  const { money, signColor } = useTableFormat();
  const start = profit(period.start);
  const end = profit(period.end);

  return (
    <NumberCell className={className} style={signColor(end)}>
      <ValueWithChange
        value={money(end)}
        change={formatChange(start, end, money)}
        changeStyle={signColor(difference(start, end))}
      />
    </NumberCell>
  );
};

export const IrrCell = ({ period, className }: CellProps<IrrPeriod>) => {
  const { irr, ratioColor } = useTableFormat();

  return (
    <NumberCell className={className} style={ratioColor(period.irrAnnual)}>
      {irr(period)}
    </NumberCell>
  );
};
