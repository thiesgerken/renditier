import { CircleAlert } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { LoadFailure } from '../useLoadFailure';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';
import { Button } from './ui/button';

interface Props {
  failure: LoadFailure;
  className?: string;
}

// Stands in for what a failed load would have shown: an empty list or a 0
// would claim an answer that never came.
const LoadError = ({ failure, className }: Props) => {
  const { t } = useTranslation();

  return (
    <Alert variant="destructive" className={className}>
      <CircleAlert />
      <AlertTitle>{t('common.loadFailed')}</AlertTitle>
      <AlertDescription>
        {/* The raw message: it tells a timeout from a lost session or a bug. */}
        <p>{failure.error.message ?? t('common.unknownError')}</p>
        <Button
          size="xs"
          variant="outline"
          className="mt-1"
          onClick={failure.retry}
        >
          {t('common.retry')}
        </Button>
      </AlertDescription>
    </Alert>
  );
};

export default LoadError;
