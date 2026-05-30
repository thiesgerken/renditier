import React from 'react';
import PropTypes from 'prop-types';
import { NumericFormat } from 'react-number-format';

export default function NumberInput(props) {
  const { inputRef, name, onChange, ...other } = props;

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
NumberInput.defaultProps = {
  name: '',
};

NumberInput.propTypes = {
  inputRef: PropTypes.func.isRequired,
  name: PropTypes.string,
  onChange: PropTypes.func.isRequired,
};
