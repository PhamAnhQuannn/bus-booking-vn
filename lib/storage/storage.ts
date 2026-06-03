/**
 * Object-storage URL minting (Issue 059, SYS20) — the signed-URL CONTRACT.
 *
 * The server NEVER proxies object bytes. It mints short-lived signed URLs and
 * the client transfers bytes directly to/from storage. The DB stores only the
 * object KEY + metadata (a StoredObject row), never the blob.
 *
 * Branches on STORAGE_STUB (mirrors PAYMENTS_STUB in lib/payment/refund.ts):
 *   - STORAGE_STUB=true  → mint a deterministic, HMAC-signed stub PUT/GET URL
 *     pointing at the dev stub-storage route. Tamper-evident via
 *     STORAGE_STUB_SECRET. This is the path every local / test transfer takes.
 *   - STORAGE_STUB=false → real S3 (@aws-sdk getSignedUrl). NOT YET IMPLEMENTED
 *     — real S3 is a Wave-9 concern (issue note) and @aws-sdk is not installed.
 *     The real branch throws StorageError('s3_not_implemented') so a non-stub
 *     deployment fails LOUDLY rather than silently minting a dead URL.
 *
 * The Prisma client is taken as a parameter (reuse-by-param, like
 * lib/audit/adminAuditLog.ts) so unit tests inject a mock and the integration
 * test / route handlers pass the app singleton.
 */

import crypto from 'crypto';
import { getEnv } from '@/lib/config/env';
import { writeAdminAuditLog, type AdminAuditLogClient } from '@/lib/audit/adminAuditLog';
import { StorageError } from './errors';
import {
  STORAGE_POLICIES,
  PII_PURPOSES,
  isStoragePurpose,
  type StoragePurpose,
} from './types';

// --- signed-URL lifetimes -----------------------------------------------------

/** Signed PUT URL lifetime: 15 minutes. */
const UPLOAD_TTL_MS = 15 * 60 * 1000;
/** Signed GET URL lifetime: 5 minutes. */
const DOWNLOAD_TTL_MS = 5 * 60 * 1000;

// --- Prisma surface (minimal, injected) --------------------------------------

export interface StoredObjectRow {
  id: string;
  key: string;
  contentType: string;
  sizeBytes: number;
  purpose: string;
  uploadedBy: string | null;
  createdAt: Date;
}

/**
 * The slice of PrismaClient this module needs. Combined with AdminAuditLogClient
 * so a single injected client satisfies both the StoredObject reads/writes and
 * the audit-log write.
 */
export interface StorageClient extends AdminAuditLogClient {
  storedObject: {
    create: (args: {
      data: {
        key: string;
        contentType: string;
        sizeBytes: number;
        purpose: string;
        uploadedBy?: string | null;
      };
    }) => Promise<StoredObjectRow>;
    findUnique: (args: { where: { key: string } }) => Promise<StoredObjectRow | null>;
    upsert: (args: {
      where: { key: string };
      create: {
        key: string;
        contentType: string;
        sizeBytes: number;
        purpose: string;
        uploadedBy?: string | null;
      };
      update: { contentType: string; sizeBytes: number };
    }) => Promise<StoredObjectRow>;
    deleteMany: (args: { where: { key: string } }) => Promise<{ count: number }>;
  };
}

// --- inputs / outputs ---------------------------------------------------------

export interface CreateSignedUploadUrlInput {
  purpose: StoragePurpose;
  contentType: string;
  sizeBytes: number;
  /** Actor id (operator/admin); null/undefined for system uploads. */
  uploadedBy?: string | null;
  /** Optional caller-supplied filename hint, sanitized into the key. */
  keyHint?: string;
  /** Override the URL origin (defaults to STORAGE_BASE_URL env or localhost). */
  baseUrl?: string;
}

export interface CreateSignedUploadUrlResult {
  key: string;
  uploadUrl: string;
  expiresAt: Date;
}

export interface CreateSignedDownloadUrlOptions {
  /** Actor id requesting the download — recorded in the PII access audit. */
  actor: string;
  /** Override the URL origin (defaults to STORAGE_BASE_URL env or localhost). */
  baseUrl?: string;
}

export interface CreateSignedDownloadUrlResult {
  downloadUrl: string;
  expiresAt: Date;
}

// --- helpers ------------------------------------------------------------------

function resolveBaseUrl(override?: string): string {
  return (
    override ??
    process.env.STORAGE_BASE_URL ??
    process.env.NEXT_PUBLIC_BASE_URL ??
    'http://localhost:3001'
  ).replace(/\/+$/, '');
}

/**
 * Stub URL signature: HMAC-SHA256 over the canonical `key|METHOD|exp` string,
 * keyed by STORAGE_STUB_SECRET. Binding the method + expiry into the signature
 * means a PUT signature can't be replayed as a GET, and an expired URL can't be
 * silently re-used past `exp`.
 */
function signStub(key: string, method: 'PUT' | 'GET', exp: number): string {
  return crypto
    .createHmac('sha256', getEnv().STORAGE_STUB_SECRET)
    .update(`${key}|${method}|${exp}`)
    .digest('hex');
}

function timingSafeHexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    const bufA = Buffer.from(a, 'hex');
    const bufB = Buffer.from(b, 'hex');
    if (bufA.length !== bufB.length) return false;
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

/** Sanitize a caller filename hint into a key-safe slug; '' if nothing usable. */
function sanitizeKeyHint(hint: string): string {
  return hint
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 80);
}

function buildKey(purpose: StoragePurpose, keyHint?: string): string {
  const uuid = crypto.randomUUID();
  const hint = keyHint ? sanitizeKeyHint(keyHint) : '';
  return hint ? `${purpose}/${uuid}/${hint}` : `${purpose}/${uuid}`;
}

/**
 * Build the dev stub-storage URL for a key + method. The bytes never touch the
 * app server in the real adapter; the stub route exists only so the
 * signed-PUT → signed-GET round-trip is exercisable in dev/test.
 */
function buildStubUrl(
  baseUrl: string,
  key: string,
  method: 'PUT' | 'GET',
  exp: number
): string {
  const sig = signStub(key, method, exp);
  const encodedKey = key.split('/').map(encodeURIComponent).join('/');
  return `${baseUrl}/dev/stub-storage/${encodedKey}?exp=${exp}&sig=${sig}`;
}

// --- public API ---------------------------------------------------------------

/**
 * Validate the upload against the per-purpose policy, persist a StoredObject
 * pointer row, and return a signed PUT URL the client uses to transfer bytes
 * directly to storage.
 *
 * Throws StorageError('invalid_content_type' | 'too_large' | 'invalid_purpose')
 * BEFORE any row is written, so a rejected upload leaves no orphan pointer.
 */
export async function createSignedUploadUrl(
  prisma: StorageClient,
  input: CreateSignedUploadUrlInput
): Promise<CreateSignedUploadUrlResult> {
  const { purpose, contentType, sizeBytes, uploadedBy, keyHint, baseUrl } = input;

  if (!isStoragePurpose(purpose)) {
    throw new StorageError('invalid_purpose', `unknown storage purpose: ${purpose}`);
  }

  const policy = STORAGE_POLICIES[purpose];

  if (!policy.allowedContentTypes.includes(contentType)) {
    throw new StorageError(
      'invalid_content_type',
      `content type ${contentType} not allowed for ${purpose}`
    );
  }

  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > policy.maxBytes) {
    throw new StorageError(
      'too_large',
      `size ${sizeBytes} exceeds limit ${policy.maxBytes} for ${purpose}`
    );
  }

  const key = buildKey(purpose, keyHint);

  await prisma.storedObject.create({
    data: { key, contentType, sizeBytes, purpose, uploadedBy: uploadedBy ?? null },
  });

  const env = getEnv();
  if (!env.STORAGE_STUB) {
    // TODO(wave9): real S3 adapter — `getSignedUrl(s3, new PutObjectCommand({
    //   Bucket: env.STORAGE_BUCKET, Key: key, ContentType: contentType }), { expiresIn })`.
    // @aws-sdk/client-s3 is not installed; deferred to the Wave-9 storage issue.
    throw new StorageError('s3_not_implemented', 'real S3 upload deferred to wave 9');
  }

  const expiresAt = new Date(Date.now() + UPLOAD_TTL_MS);
  const uploadUrl = buildStubUrl(resolveBaseUrl(baseUrl), key, 'PUT', expiresAt.getTime());

  return { key, uploadUrl, expiresAt };
}

/** Derive the storage purpose from a key's leading path segment (the buildKey scheme). */
function purposeFromKey(key: string): string {
  return key.split('/')[0] ?? '';
}

/**
 * Server-side object upload (Issue 074) — write bytes directly to storage WITHOUT
 * the signed-URL round-trip. This is the path the generate-once ticket-PDF job
 * takes: it renders the PDF in-process and uploads it here, so the job never
 * HTTP-PUTs to its own dev route (Mistake-Log 002/003: a server module must not
 * self-fetch its own API).
 *
 * Under STORAGE_STUB the bytes go into the SHARED in-memory store (stubStore)
 * that the dev stub-storage GET route + createSignedDownloadUrl read from, so the
 * subsequent signed-download serves exactly these bytes. The StoredObject pointer
 * row is UPSERTed (keyed on the unique `key`) so the audit/download path is
 * consistent and a re-upload of the same key is idempotent.
 *
 * STORAGE_STUB=false → throws StorageError('s3_not_implemented') (real S3
 * PutObject deferred to Wave 9, @aws-sdk not installed) so a non-stub deploy
 * fails LOUDLY rather than silently dropping the bytes.
 */
export async function putObject(
  prisma: StorageClient,
  key: string,
  contentType: string,
  bytes: Buffer | Uint8Array
): Promise<void> {
  const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
  const purpose = purposeFromKey(key);

  // Upsert the pointer row first so the download/audit path always finds a row
  // for a putObject-created key (parity with createSignedUploadUrl's create).
  await prisma.storedObject.upsert({
    where: { key },
    create: { key, contentType, sizeBytes: buf.length, purpose, uploadedBy: null },
    update: { contentType, sizeBytes: buf.length },
  });

  const env = getEnv();
  if (!env.STORAGE_STUB) {
    // TODO(wave9): real S3 adapter — `s3.send(new PutObjectCommand({
    //   Bucket: env.STORAGE_BUCKET, Key: key, Body: buf, ContentType: contentType }))`.
    // @aws-sdk/client-s3 is not installed; deferred to the Wave-9 storage issue.
    throw new StorageError('s3_not_implemented', 'real S3 putObject deferred to wave 9');
  }

  const { putStubBlob } = await import('./stubStore');
  putStubBlob(key, contentType, buf);
}

/**
 * Delete a stored object by key (Issue 090 retention purge). Removes the blob
 * AND the StoredObject pointer row.
 *
 * Under STORAGE_STUB the blob is removed from the SHARED in-memory store
 * (stubStore) so a subsequent createSignedDownloadUrl / GET no longer finds it.
 * The StoredObject pointer row is deleted too (deleteMany — idempotent, no throw
 * if the row is already gone), so a re-run of the sweeper over an
 * already-purged key is a no-op rather than an error.
 *
 * STORAGE_STUB=false → throws StorageError('s3_not_implemented') (real S3
 * DeleteObject deferred to Wave 9, @aws-sdk not installed) so a non-stub deploy
 * fails LOUDLY rather than silently leaving the object in the bucket.
 */
export async function deleteObject(prisma: StorageClient, key: string): Promise<void> {
  const env = getEnv();
  if (!env.STORAGE_STUB) {
    // TODO(wave9): real S3 adapter — `s3.send(new DeleteObjectCommand({
    //   Bucket: env.STORAGE_BUCKET, Key: key }))`. @aws-sdk/client-s3 not installed.
    throw new StorageError('s3_not_implemented', 'real S3 deleteObject deferred to wave 9');
  }

  const { removeStubBlob } = await import('./stubStore');
  removeStubBlob(key);

  // Remove the pointer row too (deleteMany so an absent key is a silent no-op,
  // keeping the purge idempotent under a sweeper re-run).
  await prisma.storedObject.deleteMany({ where: { key } });
}

/**
 * Mint a signed GET URL for an already-stored object. Loads the StoredObject
 * row (throws StorageError('not_found') if absent). If the object's purpose is
 * PII (kyb_doc) the access is audited via writeAdminAuditLog (AC5).
 */
export async function createSignedDownloadUrl(
  prisma: StorageClient,
  key: string,
  options: CreateSignedDownloadUrlOptions
): Promise<CreateSignedDownloadUrlResult> {
  const row = await prisma.storedObject.findUnique({ where: { key } });
  if (!row) {
    throw new StorageError('not_found', `no stored object for key ${key}`);
  }

  // PII access audit (AC5) — only for PII purposes (kyb_doc), not ticket_pdf.
  if (isStoragePurpose(row.purpose) && PII_PURPOSES.has(row.purpose)) {
    await writeAdminAuditLog(prisma, {
      actor: options.actor,
      action: 'storage-access',
      target: key,
      argsRedacted: JSON.stringify({ purpose: row.purpose }),
    });
  }

  const env = getEnv();
  if (!env.STORAGE_STUB) {
    // TODO(wave9): real S3 adapter — `getSignedUrl(s3, new GetObjectCommand({
    //   Bucket: env.STORAGE_BUCKET, Key: key }), { expiresIn })`. Deferred.
    throw new StorageError('s3_not_implemented', 'real S3 download deferred to wave 9');
  }

  const expiresAt = new Date(Date.now() + DOWNLOAD_TTL_MS);
  const downloadUrl = buildStubUrl(
    resolveBaseUrl(options.baseUrl),
    key,
    'GET',
    expiresAt.getTime()
  );

  return { downloadUrl, expiresAt };
}

/**
 * Constant-time validation of an incoming stub URL signature + expiry. Used by
 * the dev stub-storage route to authenticate an inbound PUT/GET. Rejects a
 * forged signature (HMAC mismatch) or an expired URL (`exp` in the past).
 *
 * `exp` is the epoch-millis expiry encoded in the URL; `now` is injectable for
 * deterministic tests.
 */
export function verifyStubSignature(
  key: string,
  method: 'PUT' | 'GET',
  exp: number,
  sig: string,
  now: number = Date.now()
): boolean {
  if (!Number.isFinite(exp) || exp < now) return false;
  const expected = signStub(key, method, exp);
  return timingSafeHexEqual(expected, sig);
}
