import type { ReactNode } from 'react';
import { cn } from 'cn';
import { LoaderCircle } from 'lucide-react';

import { Card } from './ui/card';

interface Props {
  loading: boolean;
  className?: string;
  children: ReactNode;
}

// A card that shows a spinner over its content while that is being loaded.
const ProgressCard = ({ loading, className, children }: Props) => (
  <Card className={cn('relative min-h-32', className)} aria-busy={loading}>
    {children}
    {loading && (
      <LoaderCircle
        aria-label="Lädt"
        className="absolute top-1/2 left-1/2 size-6 -translate-1/2 animate-spin text-muted-foreground"
      />
    )}
  </Card>
);

export default ProgressCard;
