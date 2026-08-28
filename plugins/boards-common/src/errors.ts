/**
 * The message of a caught value. A `catch` binding and a rejected query
 * are `unknown`, and while everything this code throws is an `Error`, a
 * rejection can carry anything at all — so the non-`Error` cases are
 * turned into something printable rather than asserted away.
 */
export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return String(error);
}
