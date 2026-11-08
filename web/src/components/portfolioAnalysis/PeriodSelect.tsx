import { useTranslation } from 'react-i18next';

import type { PortfolioPerformance } from '../../types/api';
import {
  RUNNING_PERIODS,
  getPeriodDescription,
  periodKey,
} from '../../selectors/performance';
import { selectPeriod } from '../../slices/period';
import { useAppDispatch } from '../../store';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { ToggleGroup, ToggleGroupItem } from '../ui/toggle-group';

interface Props {
  periods: PortfolioPerformance[];
  // the periodKey of the selected period
  selected: string;
}

// The running periods as a switch, the finished years and months, of which
// there are too many for one, in a list next to it.
const PeriodSelect = ({ periods, selected }: Props) => {
  const { t } = useTranslation();
  const dispatch = useAppDispatch();
  const select = (key: string) => dispatch(selectPeriod(key));

  const running = RUNNING_PERIODS.filter(kind =>
    periods.some(p => p.kind === kind)
  );
  const years = periods.filter(p => p.kind === 'YearToYear');
  const months = periods.filter(p => p.kind === 'MonthToMonth');
  const isRunning = running.some(kind => kind === selected);

  return (
    <div className="flex flex-wrap items-center gap-2 max-sm:w-full">
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={isRunning ? selected : ''}
        // Radix reports '' when the active item is clicked again; the period
        // stays selected then.
        onValueChange={key => key !== '' && select(key)}
        aria-label={t('period.label')}
        // Android scales text with the system font size: on phones the row
        // spans the width with little padding, and scrolls once even that is
        // too narrow rather than widening the page.
        className="max-sm:w-full max-sm:overflow-x-auto"
      >
        {running.map(kind => (
          <ToggleGroupItem
            key={kind}
            value={kind}
            // `!` because the group's own padding for spacing 0 sits behind a
            // more specific selector than a plain px-*.
            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground max-sm:grow max-sm:px-1!"
          >
            {t(`period.short.${kind}`)}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {years.length + months.length > 0 && (
        <Select value={isRunning ? '' : selected} onValueChange={select}>
          <SelectTrigger aria-label={t('period.earlierLabel')} className="w-32">
            <SelectValue placeholder={t('period.earlier')} />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            {[
              { label: t('period.years'), items: years },
              { label: t('period.months'), items: months },
            ].map(
              ({ label, items }) =>
                items.length > 0 && (
                  <SelectGroup key={label}>
                    <SelectLabel>{label}</SelectLabel>
                    {items.map(p => (
                      <SelectItem key={periodKey(p)} value={periodKey(p)}>
                        {getPeriodDescription(p)}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )
            )}
          </SelectContent>
        </Select>
      )}
    </div>
  );
};

export default PeriodSelect;
