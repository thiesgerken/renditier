import { useState } from 'react';
import type { SerializedError } from '@reduxjs/toolkit';

interface Failure {
  title: string;
  message: string;
}

// Runs a change from a dialog. The dialog closes once the change went through,
// and otherwise stays open with the error, so that the input survives.
const useChange = (onDone: () => void) => {
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, setPending] = useState(false);

  const run = async (
    change: { unwrap: () => Promise<unknown> },
    title: string
  ) => {
    setPending(true);
    setFailure(null);
    try {
      await change.unwrap();
    } catch (error) {
      // unwrap() rejects with the thunk's serialized error.
      const { message } = error as SerializedError;
      setFailure({ title, message: message ?? 'Unbekannter Fehler' });
      setPending(false);
      return;
    }
    onDone();
  };

  return { failure, pending, run };
};

export default useChange;
