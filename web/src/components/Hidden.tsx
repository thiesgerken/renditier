import type { ReactNode } from 'react';
import { useTheme, useMediaQuery } from '@mui/material';

interface Props {
  children: ReactNode;
  xsDown?: boolean;
  smDown?: boolean;
  mdUp?: boolean;
  lgDown?: boolean;
}

export default function Hidden({
  children,
  xsDown = false,
  smDown = false,
  mdUp = false,
  lgDown = false,
}: Props) {
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
