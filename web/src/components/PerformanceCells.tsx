import type { ReactNode } from 'react';
import { cn } from 'cn';
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarRange,
  ChartCandlestick,
  Hash,
  Percent,
  PiggyBank,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { PortfolioSnapshot, PositionSnapshot } from '../types/api';
import { getPrice, profit } from '../selectors/performance';
import { formatChange, formatPriceSource } from '../format';
import type { IrrPeriod } from '../format';
import useTableFormat from './useTableFormat';
import type { Tone } from './useTableFormat';
import { TableCell, TableHead } from './ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

// The columns that the performance tables of the portfolio, its positions and
// a single stock share. Their cells show the value at the end of the period,
// and its change over the period below it.

// labelled by `performance.columns.*`
const COLUMNS = {
  period: CalendarRange,
  price: ChartCandlestick,
  units: Hash,
  invested: PiggyBank,
  value: Wallet,
  profit: TrendingUp,
  irr: Percent,
} satisfies Record<string, LucideIcon>;

interface ColumnHeadProps {
  column: keyof typeof COLUMNS;
  className?: string;
}

// Phones have no room for the icons.
export const ColumnHead = ({ column, className }: ColumnHeadProps) => {
  const { t } = useTranslation();
  const Icon = COLUMNS[column];

  return (
    <TableHead className={cn(column !== 'period' && 'text-right', className)}>
      <span className="inline-flex items-center gap-1.5">
        <Icon className="hidden size-4 text-muted-foreground md:block" />
        {t(`performance.columns.${column}`)}
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

const TONE_TEXT = { gain: 'text-gain', loss: 'text-loss' };

interface ValueWithChangeProps {
  value: string;
  // see formatChange; nothing is shown below the value when it is null
  change: string | null;
  // whether the change is a gain or a loss; without it, the change is neutral
  // because its direction is neither good nor bad (more units, more invested)
  changeTone?: Tone;
}

// A table value with its change over the period below it, smaller. Neither
// line wraps, so that a cell never takes more than these two lines.
const ValueWithChange = ({
  value,
  change,
  changeTone = null,
}: ValueWithChangeProps) => {
  const Trend = changeTone === 'loss' ? ArrowDownRight : ArrowUpRight;

  return (
    <div className="whitespace-nowrap">
      {value}
      {change !== null && (
        <div
          className={cn(
            'flex items-center justify-end gap-0.5 text-xs text-muted-foreground',
            changeTone !== null && TONE_TEXT[changeTone]
          )}
        >
          {changeTone !== null && <Trend className="size-3" />}
          {change}
        </div>
      )}
    </div>
  );
};

// Numbers are right-aligned, with digits of equal width so that they line up.
const NumberCell = ({
  children,
  className,
  tone = null,
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) => (
  <TableCell
    className={cn(
      'text-right font-normal tabular-nums',
      tone !== null && TONE_TEXT[tone],
      className
    )}
  >
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
  const { money, percent, ratioTone } = useTableFormat();
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
          changeTone={ratioTone(ratio)}
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
  const { t } = useTranslation();
  const { money } = useTableFormat();
  const { start, end } = period;

  const line = (label: string, startValue: number, endValue: number) => {
    const change = formatChange(startValue, endValue, money);
    return `${label}: ${money(endValue)}${change === null ? '' : ` (${change})`}`;
  };

  const feesInfo = (
    <>
      {line(t('performance.feesIncluded'), -start.fees, -end.fees)}
      <br />
      {line(
        t('performance.feesExcluded'),
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

export const ProfitCell = ({ period, className }: CellProps<Period>) => {
  const { money, signTone } = useTableFormat();
  const start = profit(period.start);
  const end = profit(period.end);

  return (
    <NumberCell className={className} tone={signTone(end)}>
      <ValueWithChange
        value={money(end)}
        change={formatChange(start, end, money)}
        changeTone={signTone(difference(start, end))}
      />
    </NumberCell>
  );
};

export const IrrCell = ({ period, className }: CellProps<IrrPeriod>) => {
  const { irr, ratioTone } = useTableFormat();

  return (
    <NumberCell className={className} tone={ratioTone(period.irrAnnual)}>
      {irr(period)}
    </NumberCell>
  );
};
