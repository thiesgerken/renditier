import type { ReactElement } from 'react';
import { Box, Typography, useMediaQuery, useTheme } from '@mui/material';
import { ResponsiveContainer } from 'recharts';

interface Props {
  isEmpty: boolean;
  isLoading: boolean;
  // the chart itself
  children: ReactElement;
}

// Fixed-height frame for a chart; tells an empty result apart from one that is
// still loading.
const PlotArea = ({ isEmpty, isLoading, children }: Props) => {
  const theme = useTheme();
  const mdUp = useMediaQuery(theme.breakpoints.up('md'));
  const height = mdUp ? 400 : 260;

  if (isEmpty)
    return (
      <Box
        sx={{
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {!isLoading && (
          <Typography color="text.secondary">Keine Daten</Typography>
        )}
      </Box>
    );

  return (
    <ResponsiveContainer width="100%" height={height}>
      {children}
    </ResponsiveContainer>
  );
};

export default PlotArea;
