import { cn } from 'cn';
import { flatMap } from 'lodash';
import {
  ArrowLeftRight,
  Percent,
  PiggyBank,
  TrendingDown,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import type { PortfolioPerformance } from '../../types/api';
import { periodGain } from '../../selectors/performance';
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
        <span className="leading-tight">{label}</span>
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

interface Props {
  period: PortfolioPerformance;
}

// The headline numbers of a period: what the depot is worth and what was paid
// in at its end, and what it gained, earned per year and how often it traded
// during it.
const KpiHeader = ({ period }: Props) => {
  const { signTone } = useTableFormat();
  const { start, end } = period;

  const gain = periodGain(period);
  const gainTone = signTone(gain, 0);

  const transactions = flatMap(
    Object.values(period.positions),
    p => p.transactions
  );
  const annualRate = isShortPeriod(period) ? null : period.irrAnnual;

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
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
        label="Gewinn im Zeitraum"
        value={euros(gain, { signed: true })}
        detail={null}
        tone={gainTone}
      />
      <KpiTile
        icon={Percent}
        label="Zinsfuß"
        value={
          annualRate === null
            ? '—'
            : `${formatPercent(annualRate, { signed: true })} p.a.`
        }
        detail={isShortPeriod(period) ? 'erst ab einem Monat sinnvoll' : null}
        tone={signTone(annualRate, 4)}
      />
      <KpiTile
        icon={ArrowLeftRight}
        label="Transaktionen"
        value={String(transactions.length)}
        detail={null}
      />
    </div>
  );
};

export default KpiHeader;
