/**
 * Tagged error for the storage layer (Issue 059).
 *
 * `code` is a stable discriminant the caller (route handler) maps to an HTTP
 * status. Carrying the code on the error — rather than throwing bare strings —
 * lets `instanceof StorageError` + a `switch (err.code)` drive the response.
 */

export type StorageErrorCode =
  | 'invalid_content_type'
  | 'too_large'
  | 'invalid_purpose'
  | 'not_found';

export class StorageError extends Error {
  readonly code: StorageErrorCode;

  constructor(code: StorageErrorCode, message?: string) {
    super(message ?? code);
    this.name = 'StorageError';
    this.code = code;
  }
}
