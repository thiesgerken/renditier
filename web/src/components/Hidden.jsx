import PropTypes from 'prop-types';
import { useTheme, useMediaQuery } from '@mui/material';

export default function Hidden({ children, xsDown, smDown, mdUp, lgDown }) {
  const theme = useTheme();
  const hideXsDown = useMediaQuery(theme.breakpoints.down('sm'));
  const hideSmDown = useMediaQuery(theme.breakpoints.down('md'));
  const hideMdUp = useMediaQuery(theme.breakpoints.up('md'));
  const hideLgDown = useMediaQuery(theme.breakpoints.down('xl'));

  const hidden =
    (xsDown && hideXsDown) ||
    (smDown && hideSmDown) ||
    (mdUp && hideMdUp) ||
    (lgDown && hideLgDown);

  return hidden ? null : children;
}

Hidden.defaultProps = {
  xsDown: false,
  smDown: false,
  mdUp: false,
  lgDown: false,
};

Hidden.propTypes = {
  children: PropTypes.node.isRequired,
  xsDown: PropTypes.bool,
  smDown: PropTypes.bool,
  mdUp: PropTypes.bool,
  lgDown: PropTypes.bool,
};
