/**
 * POST /api/op/kyb/upload-url (Issue 077)
 *
 * Operator-scoped. Mints a signed PUT URL for a KYB document upload and persists
 * the KybDocument pointer row. The client then PUTs the file DIRECTLY to the
 * returned uploadUrl — the server NEVER proxies the bytes (AGENTS.md 002/003).
 *
 * Body: { type, contentType, sizeBytes }
 *   - type ∈ 'business_license' | 'identity' | 'payout_account'
 * Errors:
 *   400 invalid_body / invalid_input
 *   422 INVALID_TYPE          — KybError('invalid_type')
 *   422 INVALID_CONTENT_TYPE  — StorageError('invalid_content_type')
 *   422 TOO_LARGE             — StorageError('too_large')
 * Success: 200 { uploadUrl, key, kybDocumentId }
 *
 * Operator scope (operatorId) comes from the JWT context, never the body.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { requireOperatorAuth, type OperatorAuthContext } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { prisma } from '@/lib/core/db/client';
import { requestKybUploadUrl, KybError } from '@/lib/onboarding/kyb';
import { StorageError } from '@/lib/storage';

interface UploadUrlBody {
  type?: unknown;
  contentType?: unknown;
  sizeBytes?: unknown;
}

async function postHandler(req: NextRequest, ctx: OperatorAuthContext): Promise<Response> {
  let body: UploadUrlBody;
  try {
    body = (await req.json()) as UploadUrlBody;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const { type, contentType, sizeBytes } = body;
  if (
    typeof type !== 'string' ||
    typeof contentType !== 'string' ||
    typeof sizeBytes !== 'number'
  ) {
    return NextResponse.json({ error: 'invalid_input' }, { status: 400 });
  }

  try {
    const result = await requestKybUploadUrl(prisma, {
      operatorId: ctx.operatorId,
      type,
      contentType,
      sizeBytes,
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof KybError) {
      return NextResponse.json({ error: 'INVALID_TYPE' }, { status: 422 });
    }
    if (e instanceof StorageError) {
      if (e.code === 'invalid_content_type') {
        return NextResponse.json({ error: 'INVALID_CONTENT_TYPE' }, { status: 422 });
      }
      if (e.code === 'too_large') {
        return NextResponse.json({ error: 'TOO_LARGE' }, { status: 422 });
      }
    }
    throw e;
  }
}

export const POST = withErrorHandler(
  requireOperatorAuth({})(postHandler) as (req: NextRequest) => Promise<Response>
);
