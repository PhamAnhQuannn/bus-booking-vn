/**
 * Process-local stub byte store (Issue 059 / Issue 074).
 *
 * Dev-only, NON-PERSISTENT in-memory blob store keyed by object key. Stands in
 * for the real S3 object body so the signed-PUT → signed-GET contract (and the
 * server-side putObject upload path added in Issue 074) is exercisable end-to-end
 * WITHOUT real S3 or @aws-sdk. A server restart drops every byte.
 *
 * SHARED so all three paths see the same bytes:
 *   - the dev stub-storage route's PUT (client signed-upload) + GET (signed-download)
 *   - putObject() (lib/storage server-side upload — the generate-once job's path)
 *
 * Before Issue 074 the Map lived inside the dev route module; the job's
 * putObject must write into the SAME store the GET route + signed-download read
 * from, so it was hoisted here. The `globalThis` pin survives Next.js dev hot-
 * reload (each route module re-eval would otherwise get a fresh Map).
 */

export interface StubBlob {
  contentType: string;
  bytes: Buffer;
}

const GLOBAL_KEY = '__bb_stub_storage_blobs__';

type GlobalWithStore = typeof globalThis & {
  [GLOBAL_KEY]?: Map<string, StubBlob>;
};

const g = globalThis as GlobalWithStore;

/** The single process-wide stub blob store. */
export const STUB_BLOBS: Map<string, StubBlob> = (g[GLOBAL_KEY] ??= new Map());

export function putStubBlob(key: string, contentType: string, bytes: Buffer): void {
  STUB_BLOBS.set(key, { contentType, bytes });
}

export function getStubBlob(key: string): StubBlob | undefined {
  return STUB_BLOBS.get(key);
}
