import { cn } from 'cn';
import { flatMap } from 'lodash';
import {
  ArrowLeftRight,
  Percent,
  PiggyBank,
  Receipt,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { PortfolioPerformance, PortfolioSnapshot } from '../../types/api';
import {
  formatChange,
  formatCurrency,
  formatPercent,
  isShortPeriod,
} from '../../format';
import type { Formatter } from '../../format';
import useTableFormat from '../useTableFormat';
import type { Tone } from '../useTableFormat';
import { Card } from '../ui/card';

// Headline numbers have no room for cents.
const euros: Formatter = (value, options) =>
  formatCurrency(value, { digits: 0, ...options });

const TONES = {
  neutral: { circle: 'bg-primary/10 text-primary', value: '' },
  gain: { circle: 'bg-gain/10 text-gain', value: 'text-gain' },
  loss: { circle: 'bg-loss/10 text-loss', value: 'text-loss' },
};

interface TileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string | null;
  tone?: Tone;
}

const KpiTile = ({ icon: Icon, label, value, detail, tone }: TileProps) => {
  const styles = TONES[tone ?? 'neutral'];

  return (
    <Card size="sm" className="gap-2 px-3">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-full',
            styles.circle
          )}
        >
          <Icon className="size-4" />
        </span>
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          'text-xl font-semibold tabular-nums sm:text-2xl',
          styles.value
        )}
      >
        {value}
      </div>
      {/* keeps the tiles of a row equally high when one has no detail */}
      <div className="min-h-4 text-xs text-muted-foreground">{detail}</div>
    </Card>
  );
};

const profit = (snapshot: PortfolioSnapshot) =>
  snapshot.value === null ? null : snapshot.value + snapshot.invested;

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

interface Props {
  period: PortfolioPerformance;
}

// The headline numbers of a period: what the depot is worth and what was paid
// in at its end, and what it gained, earned per year, cost in fees and how
// often it traded during it.
const KpiHeader = ({ period }: Props) => {
  const { signTone } = useTableFormat();
  const { start, end } = period;

  const startProfit = profit(start);
  const endProfit = profit(end);
  const gain =
    startProfit === null || endProfit === null ? null : endProfit - startProfit;
  const gainTone = signTone(gain, 0);

  // `fees` are negative and add up over time
  const fees = start.fees - end.fees;

  const transactions = flatMap(
    Object.values(period.positions),
    p => p.transactions
  );
  const buys = transactions.filter(t => t.units > 0).length;
  const sells = transactions.filter(t => t.units < 0).length;
  // money paid out without units changing hands
  const distributions = transactions.filter(
    t => t.units === 0 && t.amount > 0
  ).length;
  // e.g. fees booked on their own
  const others = transactions.length - buys - sells - distributions;

  const annualRate = isShortPeriod(period) ? null : period.irrAnnual;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
      <KpiTile
        icon={Wallet}
        label="Depotwert"
        value={euros(end.value)}
        detail={formatChange(start.value, end.value, euros)}
      />
      <KpiTile
        icon={PiggyBank}
        label="Investiert"
        value={euros(-end.invested)}
        detail={formatChange(-start.invested, -end.invested, euros)}
      />
      <KpiTile
        icon={gainTone === 'loss' ? TrendingDown : TrendingUp}
        label="Gewinn"
        value={euros(gain, { signed: true })}
        detail={
          period.irrPeriod === null
            ? null
            : `${formatPercent(period.irrPeriod, { signed: true })} Rendite`
        }
        tone={gainTone}
      />
      <KpiTile
        icon={Percent}
        label="Zinsfuß"
        value={
          annualRate === null
            ? '—'
            : formatPercent(annualRate, { signed: true })
        }
        detail={
          isShortPeriod(period) ? 'erst ab einem Monat sinnvoll' : 'pro Jahr'
        }
        tone={signTone(annualRate, 4)}
      />
      <KpiTile
        icon={Receipt}
        label="Gebühren"
        value={formatCurrency(fees)}
        detail={
          period.kind === 'Total'
            ? null
            : `insgesamt ${formatCurrency(-end.fees)}`
        }
      />
      <KpiTile
        icon={ArrowLeftRight}
        label="Transaktionen"
        value={String(transactions.length)}
        detail={[
          count(buys, 'Kauf', 'Käufe'),
          count(sells, 'Verkauf', 'Verkäufe'),
          ...(distributions > 0
            ? [count(distributions, 'Ausschüttung', 'Ausschüttungen')]
            : []),
          ...(others > 0 ? [count(others, 'sonstige', 'sonstige')] : []),
        ].join(' · ')}
      />
    </div>
  );
};

export default KpiHeader;
