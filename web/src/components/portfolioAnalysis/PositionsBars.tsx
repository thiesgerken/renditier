import { useState } from 'react';
import { map } from 'lodash';
import { useTranslation } from 'react-i18next';

import type {
  PortfolioPerformance,
  PositionPerformance,
} from '../../types/api';
import type { StocksState } from '../../types/store';
import { findStock, capitalizeTitle } from '../../selectors/stocks';
import { isHeld, periodGain } from '../../selectors/performance';
import ProgressCard from '../ProgressCard';
import BarList from '../BarList';
import type { BarItem } from '../BarList';
import { CardContent } from '../ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import useTableFormat from '../useTableFormat';

// The amount of a position per mode (labelled by `positionsBars.modes.*`);
// null when it is unknown because the position has no price. Sold positions
// are no part of what is invested or held, but what they gained or lost
// within the period counts.
const MODES = {
  invested: (p: PositionPerformance) => (isHeld(p) ? -p.end.invested : 0),
  value: (p: PositionPerformance) => p.end.value,
  profit: (p: PositionPerformance) => {
    const x = periodGain(p);
    return x === null ? null : Math.max(0, x);
  },
  loss: (p: PositionPerformance) => {
    const x = periodGain(p);
    return x === null ? null : Math.max(0, -x);
  },
};

type Mode = keyof typeof MODES;

// The dashboard has the full positions table right above, so this list is
// about proportions: ten rows cover nearly all of a typical portfolio.
const MAX_ROWS = 10;

interface Props {
  // the positions at the end of this period
  period: PortfolioPerformance | undefined;
  loading: boolean;
  stocks: StocksState;
}

const isMode = (value: string): value is Mode => value in MODES;

const PositionsBars = ({ period, loading, stocks }: Props) => {
  const { money } = useTableFormat();
  const { t } = useTranslation();
  const [mode, setMode] = useState<Mode>('invested');

  const positions =
    period === undefined
      ? []
      : map(period.positions, (p, isin) => {
          const stock = findStock(stocks, isin);
          // the full title, because share classes of one fund differ only at
          // its end, and the labels must tell them apart
          return {
            label: stock === null ? isin : capitalizeTitle(stock.title),
            amount: MODES[mode](p),
          };
        });

  const items: BarItem[] = positions.flatMap(p =>
    p.amount === null ? [] : [{ label: p.label, value: p.amount }]
  );
  const unpriced = positions.filter(p => p.amount === null);

  return (
    <ProgressCard loading={loading}>
      <CardContent className="flex flex-col gap-3">
        <BarList
          title={t(`positionsBars.titles.${mode}`)}
          items={items}
          maxRows={MAX_ROWS}
          formatValue={v => money(v, { digits: 0 })}
          note={
            unpriced.length > 0
              ? t('positionsBars.unpriced', {
                  names: unpriced.map(p => p.label).join(', '),
                })
              : undefined
          }
        />
        <Select
          value={mode}
          onValueChange={value => isMode(value) && setMode(value)}
        >
          <SelectTrigger aria-label={t('positionsBars.label')} className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {Object.keys(MODES)
              .filter(isMode)
              .map(value => (
                <SelectItem key={value} value={value}>
                  {t(`positionsBars.modes.${value}`)}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </CardContent>
    </ProgressCard>
  );
};

export default PositionsBars;
