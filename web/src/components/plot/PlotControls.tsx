import type { ReactNode } from 'react';

import type { DataSourceSelection } from '../../types/api';
import DatePicker from '../DatePicker';
import { Label } from '../ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';

// The row of settings below a plot; wraps on narrow screens.
export const PlotControls = ({ children }: { children: ReactNode }) => (
  <div className="flex flex-wrap items-end gap-x-4 gap-y-3 px-2 pt-2">
    {children}
  </div>
);

const Field = ({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: ReactNode;
}) => (
  <div className="grid gap-1.5">
    <Label htmlFor={id} className="text-xs text-muted-foreground">
      {label}
    </Label>
    {children}
  </div>
);

export interface Option<T extends string> {
  value: T;
  label: string;
}

interface SelectFieldProps<T extends string> {
  id: string;
  label: string;
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
}

export const SelectField = <T extends string>({
  id,
  label,
  value,
  options,
  onChange,
}: SelectFieldProps<T>) => (
  <Field id={id} label={label}>
    <Select
      value={value}
      onValueChange={v => {
        const option = options.find(o => o.value === v);
        if (option !== undefined) onChange(option.value);
      }}
    >
      <SelectTrigger id={id} className="min-w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map(o => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  </Field>
);

export const SOURCES: Option<DataSourceSelection>[] = [
  { value: 'auto', label: 'Automatisch' },
  { value: 'historical', label: 'Historisch' },
  { value: 'realtime', label: 'Echtzeit' },
];

export type DateRange = [Temporal.PlainDate, Temporal.PlainDate];

interface DateRangeFieldsProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
}

// Start and end of a custom range, which never ends before it starts.
export const DateRangeFields = ({
  value: [start, end],
  onChange,
}: DateRangeFieldsProps) => (
  // start and end wrap together
  <div className="flex gap-4">
    <Field id="plot-start" label="Start">
      <DatePicker
        id="plot-start"
        value={start}
        max={end}
        onChange={d => onChange([d, end])}
      />
    </Field>
    <Field id="plot-end" label="Ende">
      <DatePicker
        id="plot-end"
        value={end}
        // an end before the start moves the start along
        onChange={d =>
          onChange([Temporal.PlainDate.compare(d, start) < 0 ? d : start, d])
        }
      />
    </Field>
  </div>
);
