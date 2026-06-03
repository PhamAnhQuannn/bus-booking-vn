/**
 * Dev-only stub-storage endpoint (Issue 059).
 *
 * Stands in for the S3 object endpoint so the signed-PUT → signed-GET contract
 * is exercisable end-to-end in dev/test WITHOUT real S3 or @aws-sdk. Bytes live
 * in a process-local in-memory Map keyed by the object key — NON-PERSISTENT and
 * NOT for production (a server restart drops every byte). This route only ever
 * runs when STORAGE_STUB is on; it refuses otherwise.
 *
 * Both verbs authenticate the inbound request via verifyStubSignature (constant-
 * time HMAC over `key|METHOD|exp` + expiry check), so a forged or expired signed
 * URL is rejected exactly as a real S3 pre-signed URL would be.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/config/env';
import { verifyStubSignature } from '@/lib/storage';

/** Process-local byte store. Dev-only, non-persistent. */
const STUB_BLOBS = new Map<string, { contentType: string; bytes: Buffer }>();

interface RouteContext {
  params: Promise<{ key: string[] }>;
}

function readSig(req: NextRequest): { exp: number; sig: string } {
  const url = new URL(req.url);
  return {
    exp: Number(url.searchParams.get('exp') ?? 'NaN'),
    sig: url.searchParams.get('sig') ?? '',
  };
}

function guardEnabled(): NextResponse | null {
  if (!getEnv().STORAGE_STUB) {
    return NextResponse.json({ error: 'stub_storage_disabled' }, { status: 404 });
  }
  return null;
}

export async function PUT(req: NextRequest, ctx: RouteContext): Promise<NextResponse> {
  const disabled = guardEnabled();
  if (disabled) return disabled;

  const { key: segments } = await ctx.params;
  const key = segments.map(decodeURIComponent).join('/');
  const { exp, sig } = readSig(req);

  if (!verifyStubSignature(key, 'PUT', exp, sig)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 403 });
  }

  const contentType = req.headers.get('content-type') ?? 'application/octet-stream';
  const bytes = Buffer.from(await req.arrayBuffer());
  STUB_BLOBS.set(key, { contentType, bytes });

  return NextResponse.json({ ok: true, key, sizeBytes: bytes.length }, { status: 200 });
}

export async function GET(req: NextRequest, ctx: RouteContext): Promise<Response> {
  const disabled = guardEnabled();
  if (disabled) return disabled;

  const { key: segments } = await ctx.params;
  const key = segments.map(decodeURIComponent).join('/');
  const { exp, sig } = readSig(req);

  if (!verifyStubSignature(key, 'GET', exp, sig)) {
    return NextResponse.json({ error: 'invalid_signature' }, { status: 403 });
  }

  const blob = STUB_BLOBS.get(key);
  if (!blob) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return new Response(new Uint8Array(blob.bytes), {
    status: 200,
    headers: { 'content-type': blob.contentType },
  });
}
