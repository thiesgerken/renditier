import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { de, enUS } from 'react-day-picker/locale';
import { useTranslation } from 'react-i18next';

import { formatDate } from '../format';
import { currentLanguage } from '../i18n';
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

// month and weekday names, and the first day of the week
const CALENDAR_LOCALES = { de, en: enUS };

interface Props {
  id?: string;
  value: Temporal.PlainDate | null;
  onChange: (date: Temporal.PlainDate) => void;
  // the last selectable day
  max?: Temporal.PlainDate;
  invalid?: boolean;
}

const DatePicker = ({ id, value, onChange, max, invalid }: Props) => {
  const { t } = useTranslation();
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
          className="w-full justify-start font-light"
        >
          <CalendarIcon />
          {value === null ? (
            <span className="text-muted-foreground">
              {t('common.pickDate')}
            </span>
          ) : (
            formatDate(value)
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          locale={CALENDAR_LOCALES[currentLanguage()]}
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
