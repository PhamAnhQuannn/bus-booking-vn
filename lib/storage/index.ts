/**
 * Storage layer barrel (Issue 059). Server mints signed PUT/GET URLs; the DB
 * stores object KEYS, never bytes. Stub mode is fully exercisable locally;
 * real S3/R2 adapter activated by STORAGE_STUB=false.
 */

export {
  createSignedUploadUrl,
  createSignedDownloadUrl,
  putObject,
  deleteObject,
  verifyStubSignature,
  _resetS3Client,
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
