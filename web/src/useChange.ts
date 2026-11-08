import { useState } from 'react';
import type { SerializedError } from '@reduxjs/toolkit';
import { useTranslation } from 'react-i18next';

interface Failure {
  title: string;
  message: string;
}

// Runs a change from a dialog. The dialog closes once the change went through,
// and otherwise stays open with the error, so that the input survives.
const useChange = <R>(onDone: (result: R) => void) => {
  const { t } = useTranslation();
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, setPending] = useState(false);

  const run = async (change: { unwrap: () => Promise<R> }, title: string) => {
    setPending(true);
    setFailure(null);
    let result: R;
    try {
      result = await change.unwrap();
    } catch (error) {
      // unwrap() rejects with the thunk's serialized error.
      const { message } = error as SerializedError;
      setFailure({ title, message: message ?? t('common.unknownError') });
      setPending(false);
      return;
    }
    onDone(result);
  };

  return { failure, pending, run };
};

export default useChange;
