import { NumericFormat } from 'react-number-format';
import type { NumericFormatProps } from 'react-number-format';

// `onChange` is not a DOM change handler here: the component synthesizes a
// minimal `{ target: { name, value } }` object for MUI's TextField, which is the
// only consumer (it passes NumberInput as `inputComponent`).
interface Props extends Omit<NumericFormatProps, 'onChange' | 'getInputRef'> {
  inputRef: (el: HTMLInputElement) => void;
  onChange: (event: { target: { name: string; value: string } }) => void;
}

export default function NumberInput(props: Props) {
  const { inputRef, name = '', onChange, ...other } = props;

  return (
    <NumericFormat
      // eslint-disable-next-line react/jsx-props-no-spreading
      {...other}
      getInputRef={inputRef}
      onValueChange={values => {
        onChange({
          target: {
            name,
            value: values.value,
          },
        });
      }}
      thousandSeparator=","
      valueIsNumericString
    />
  );
}
