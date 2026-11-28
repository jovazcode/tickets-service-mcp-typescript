/** Stable codes of expected business failures. */
export type DomainErrorCode =
  | 'NOT_FOUND'
  | 'VALIDATION_ERROR'
  | 'WRITE_DISABLED'
  | 'PERSISTENCE_ERROR';

/**
 * Expected business failure with a stable `code` clients can interpret.
 *
 * Its `message` starts with the code (`NOT_FOUND: ...`). A tool handler can
 * simply throw it: the SDK turns the exception into an `isError: true` result
 * whose text is the message, which is what the model reads.
 */
export class DomainError extends Error {
  override readonly name = 'DomainError';

  constructor(
    readonly code: DomainErrorCode,
    detail: string,
  ) {
    super(`${code}: ${detail}`);
  }
}
