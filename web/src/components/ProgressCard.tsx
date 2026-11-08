import type { ReactNode } from 'react';
import { cn } from 'cn';
import { LoaderCircle } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { LoadFailure } from '../useLoadFailure';
import LoadError from './LoadError';
import { Card } from './ui/card';

interface Props {
  loading: boolean;
  failure: LoadFailure | null;
  className?: string;
  children: ReactNode;
}

// A card that shows a spinner over its content while that is being loaded, and
// the error in its place once loading failed.
const ProgressCard = ({ loading, failure, className, children }: Props) => {
  const { t } = useTranslation();

  // The alert is a box of its own; inside the card it would be a box in a box.
  if (failure !== null) return <LoadError failure={failure} />;

  return (
    <Card className={cn('relative min-h-32', className)} aria-busy={loading}>
      {children}
      {loading && (
        <LoaderCircle
          aria-label={t('common.loading')}
          className="absolute top-1/2 left-1/2 size-6 -translate-1/2 animate-spin text-muted-foreground"
        />
      )}
    </Card>
  );
};

export default ProgressCard;
