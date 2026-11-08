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
import { useTranslation } from 'react-i18next';

import type { PortfolioPerformance } from '../../types/api';
import { periodGain } from '../../selectors/performance';
import { formatChange, formatPercent, isShortPeriod } from '../../format';
import type { Formatter } from '../../format';
import useTableFormat from '../useTableFormat';
import type { Tone } from '../useTableFormat';
import { Card } from '../ui/card';

const TONES = {
  neutral: { circle: 'bg-primary/10 text-primary', value: '' },
  gain: { circle: 'bg-gain/10 text-gain', value: 'text-gain' },
  loss: { circle: 'bg-loss/10 text-loss', value: 'text-loss' },
};

interface TileProps {
  icon: LucideIcon;
  label: string;
  value: string;
  // the exact value where `value` is rounded or abbreviated
  title?: string;
  detail: string | null;
  tone?: Tone;
}

const KpiTile = ({
  icon: Icon,
  label,
  value,
  title,
  detail,
  tone,
}: TileProps) => {
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
          'text-xl font-medium tabular-nums sm:text-2xl',
          styles.value
        )}
      >
        {title === undefined ? (
          value
        ) : (
          <abbr title={title} className="no-underline">
            {value}
          </abbr>
        )}
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
  const { t } = useTranslation();
  const { money, exactMoney, signTone } = useTableFormat();
  const { start, end } = period;

  // headline numbers have no room for cents
  const euros: Formatter = (value, options) =>
    money(value, { ...options, digits: 0 });

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
        label={t('kpi.portfolioValue')}
        value={euros(end.value)}
        title={exactMoney(end.value)}
        detail={formatChange(start.value, end.value, euros)}
      />
      <KpiTile
        icon={PiggyBank}
        label={t('kpi.invested')}
        value={euros(-end.invested)}
        title={exactMoney(-end.invested)}
        detail={formatChange(-start.invested, -end.invested, euros)}
      />
      <KpiTile
        icon={gainTone === 'loss' ? TrendingDown : TrendingUp}
        label={t('kpi.gain')}
        value={euros(gain, { signed: true })}
        title={exactMoney(gain)}
        detail={null}
        tone={gainTone}
      />
      <KpiTile
        icon={Percent}
        label={t('kpi.irr')}
        value={
          annualRate === null
            ? '—'
            : `${formatPercent(annualRate, { signed: true })} p.a.`
        }
        detail={isShortPeriod(period) ? t('kpi.irrTooShort') : null}
        tone={signTone(annualRate, 4)}
      />
      <KpiTile
        icon={ArrowLeftRight}
        label={t('kpi.transactions')}
        value={String(transactions.length)}
        detail={null}
      />
    </div>
  );
};

export default KpiHeader;
