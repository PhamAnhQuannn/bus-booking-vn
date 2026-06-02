---
depends-on: [038-scaffold-lib-core-tenant-helper-lint]
type: FEATURE
wave: 2
spec: [SYS11, S03, S05]
---

## Parent PRD

`issues/prd.md` · spec `rebuild-plan.md` [SYS11]

## What to build

The **storage layer** — S3 private bucket + signed URLs, no byte-proxying through the app.
Foundational enabler for KYB docs (Wave 5) + async ticket PDFs (Wave 4). Today there is no
storage client at all.

- `lib/storage` client (per SYS20 target): wrap an S3-compatible SDK (`@aws-sdk/client-s3` +
  `getSignedUrl`). Private bucket; server mints **signed PUT** (direct client→S3 upload) +
  **signed GET** URLs — server never streams bytes.
- A `StoredObject`/document key model (or a `key` column convention) so DB stores the key,
  not the bytes. Generic enough for both KYB docs + ticket PDFs.
- Upload validation: size + content-type checks; optional AV-scan hook (deferred). Access
  audit-logged where PII (KYB docs).
- Config: bucket/region/credentials via env (zod-validated in `lib/config/env.ts`); a local
  stub (e.g. filesystem or MinIO) so tests + dev don't need real S3 — gate behind a flag
  consistent with `PAYMENTS_STUB`/`NOTIFY_STUB`.

## Acceptance criteria

- [ ] `lib/storage` mints signed PUT + GET URLs; server does not proxy bytes.
- [ ] DB stores object keys (model/column), never blobs.
- [ ] Upload size + content-type validation enforced.
- [ ] Env config (zod) + a local/stub mode for dev + tests (no real S3 required).
- [ ] PII-doc access is audit-logged.

## Blocked by

- Blocked by `issues/038-scaffold-lib-core-tenant-helper-lint.md`

## User stories addressed

- [SYS11] S3 private bucket + signed URLs; direct client upload; keys in DB.
