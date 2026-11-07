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
  const dispatch = useAppDispatch();
  const select = (key: string) => dispatch(selectPeriod(key));

  const running = RUNNING_PERIODS.filter(r =>
    periods.some(p => p.kind === r.kind)
  );
  const years = periods.filter(p => p.kind === 'YearToYear');
  const months = periods.filter(p => p.kind === 'MonthToMonth');
  const isRunning = running.some(r => r.kind === selected);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <ToggleGroup
        type="single"
        variant="outline"
        spacing={0}
        value={isRunning ? selected : ''}
        // Radix reports '' when the active item is clicked again; the period
        // stays selected then.
        onValueChange={key => key !== '' && select(key)}
        aria-label="Zeitraum"
      >
        {running.map(r => (
          <ToggleGroupItem
            key={r.kind}
            value={r.kind}
            className="px-3 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
          >
            {r.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {years.length + months.length > 0 && (
        <Select value={isRunning ? '' : selected} onValueChange={select}>
          <SelectTrigger aria-label="Früherer Zeitraum" className="w-32">
            <SelectValue placeholder="Früher" />
          </SelectTrigger>
          <SelectContent position="popper" align="end">
            {[
              { label: 'Jahre', items: years },
              { label: 'Monate', items: months },
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
