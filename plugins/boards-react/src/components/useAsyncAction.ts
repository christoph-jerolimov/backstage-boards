import { useCallback, useState } from 'react';
import { errorMessage } from '@internal/plugin-boards-common';

export interface AsyncActionHandle {
  /** The message of the last failure, until the next run starts. */
  error?: string;
  /** True while an action is in flight. */
  pending: boolean;
  /** Runs the action, resolving to the failure message, or undefined. */
  run: (action: () => Promise<unknown>) => Promise<string | undefined>;
  setError: (message?: string) => void;
}

/**
 * Runs a mutation, reporting whether it failed and keeping the message
 * of the last failure — the try/catch that every dialog, page and menu
 * triggering an API call would otherwise write for itself.
 *
 * Cleanup stays at the call site: `run` resolves to the failure message
 * (undefined when the action succeeded), so the caller decides what a
 * failure has to resync — and can hand the message somewhere else
 * without waiting for this hook's own state to settle.
 */
export function useAsyncAction(options?: {
  /** The message shown for a failure; defaults to the error's own. */
  formatError?: (error: unknown) => string;
}): AsyncActionHandle {
  const [error, setError] = useState<string | undefined>();
  const [pending, setPending] = useState(false);
  const formatError = options?.formatError;

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setError(undefined);
      setPending(true);
      try {
        await action();
        return undefined;
      } catch (err) {
        const message = formatError?.(err) ?? errorMessage(err);
        setError(message);
        return message;
      } finally {
        setPending(false);
      }
    },
    [formatError],
  );

  return { error, pending, run, setError };
}
