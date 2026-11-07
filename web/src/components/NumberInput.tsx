import type { ComponentProps } from 'react';
import { NumericFormat } from 'react-number-format';
import type { NumericFormatProps } from 'react-number-format';

import { numberSeparators } from '../format';
import { Input } from './ui/input';

type Props = Omit<
  NumericFormatProps<ComponentProps<typeof Input>>,
  'customInput' | 'onValueChange' | 'onChange' | 'value'
> & {
  // the number as a plain numeric string ('-1234.5'), whatever the display
  value: string | number;
  onValueChange: (value: string) => void;
};

// A number field in the notation of formatNumber (1.234,56 in German) that
// hands out plain numeric strings, so callers can parse them with parseFloat.
const NumberInput = ({ value, onValueChange, ...props }: Props) => {
  const { decimal, group } = numberSeparators();

  return (
    <NumericFormat
      {...props}
      customInput={Input}
      value={value}
      valueIsNumericString
      thousandSeparator={group}
      decimalSeparator={decimal}
      onValueChange={values => onValueChange(values.value)}
    />
  );
};

export default NumberInput;
