import type { ReactElement } from 'react';
import { ResponsiveContainer } from 'recharts';

interface Props {
  isEmpty: boolean;
  isLoading: boolean;
  // the chart itself
  children: ReactElement;
}

// Fixed-height frame for a chart; tells an empty result apart from one that is
// still loading.
const PlotArea = ({ isEmpty, isLoading, children }: Props) => (
  <div className="h-[260px] md:h-[400px]">
    {isEmpty ? (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        {!isLoading && 'Keine Daten'}
      </div>
    ) : (
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    )}
  </div>
);

export default PlotArea;
