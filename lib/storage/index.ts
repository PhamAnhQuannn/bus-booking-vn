/**
 * Storage layer barrel (Issue 059). Server mints signed PUT/GET URLs; the DB
 * stores object KEYS, never bytes. Stub mode is fully exercisable locally;
 * the real S3 adapter is deferred behind STORAGE_STUB (Wave 9).
 */

export {
  createSignedUploadUrl,
  createSignedDownloadUrl,
  putObject,
  verifyStubSignature,
  type StorageClient,
  type StoredObjectRow,
  type CreateSignedUploadUrlInput,
  type CreateSignedUploadUrlResult,
  type CreateSignedDownloadUrlOptions,
  type CreateSignedDownloadUrlResult,
} from './storage';
export { StorageError, type StorageErrorCode } from './errors';
export {
  STORAGE_POLICIES,
  PII_PURPOSES,
  isStoragePurpose,
  type StoragePurpose,
  type StoragePolicy,
} from './types';
