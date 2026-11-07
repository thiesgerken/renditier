import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { de } from 'react-day-picker/locale';

import { Button } from './ui/button';
import { Calendar } from './ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

// react-day-picker works with Date objects at local midnight.
const toDate = (date: Temporal.PlainDate) =>
  new Date(date.year, date.month - 1, date.day);

const toPlainDate = (date: Date) =>
  Temporal.PlainDate.from({
    year: date.getFullYear(),
    month: date.getMonth() + 1,
    day: date.getDate(),
  });

// The year dropdown starts here; the app holds nothing older.
const FIRST_MONTH = new Date(2000, 0);

interface Props {
  id?: string;
  value: Temporal.PlainDate | null;
  onChange: (date: Temporal.PlainDate) => void;
  // the last selectable day
  max?: Temporal.PlainDate;
  invalid?: boolean;
}

const DatePicker = ({ id, value, onChange, max, invalid }: Props) => {
  const [open, setOpen] = useState(false);
  const lastMonth = toDate(max ?? Temporal.Now.plainDateISO());

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          aria-invalid={invalid}
          className="w-full justify-start font-normal"
        >
          <CalendarIcon />
          {value === null ? (
            <span className="text-muted-foreground">Datum wählen</span>
          ) : (
            value.toLocaleString('de-DE', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={de}
          captionLayout="dropdown"
          startMonth={FIRST_MONTH}
          endMonth={lastMonth}
          defaultMonth={value === null ? lastMonth : toDate(value)}
          selected={value === null ? undefined : toDate(value)}
          disabled={max === undefined ? undefined : { after: toDate(max) }}
          onSelect={date => {
            if (date === undefined) return;
            onChange(toPlainDate(date));
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
};

export default DatePicker;
