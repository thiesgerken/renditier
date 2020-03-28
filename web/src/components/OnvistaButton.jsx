import { withStyles, Tooltip, Button } from '@material-ui/core';
import React from 'react';
import PropTypes from 'prop-types';

const StyledButton = withStyles(() => ({
  root: { textTransform: 'none', fontWeight: 600 },
}))(Button);

const OnvistaButton = ({ relativeUrl }) => (
  <Tooltip title="auf onvista.de ansehen" arrow>
    <StyledButton
      color="secondary"
      rel="noreferrer"
      size="small"
      href={`https://www.onvista.de${relativeUrl}`}
      target="_blank"
    >
      onvista
    </StyledButton>
  </Tooltip>
);

OnvistaButton.propTypes = {
  relativeUrl: PropTypes.string.isRequired,
};

export default OnvistaButton;
