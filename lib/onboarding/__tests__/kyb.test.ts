/**
 * Issue 077: unit tests for the KYB service (lib/onboarding/kyb.ts).
 *
 * Mocks the storage layer (createSignedUploadUrl) and the 045 transition service
 * (transitionOperatorStatus); injects a Prisma-like stub for kybDocument. Covers:
 *   - requestKybUploadUrl validates type, mints a signed PUT URL, creates a row,
 *     returns { uploadUrl, key, kybDocumentId }
 *   - invalid type → KybError('invalid_type') BEFORE any storage/DB call
 *   - StorageError (content-type / size) surfaced from createSignedUploadUrl
 *   - listOperatorKybDocs scopes by operatorId, newest first
 *   - submitForReview calls the 045 transition with to:UNDER_REVIEW + actor
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockCreateSignedUploadUrl, mockTransition } = vi.hoisted(() => ({
  mockCreateSignedUploadUrl: vi.fn(),
  mockTransition: vi.fn(),
}));

vi.mock('@/lib/storage', async () => {
  const actual = await vi.importActual<typeof import('@/lib/storage')>('@/lib/storage');
  return { ...actual, createSignedUploadUrl: mockCreateSignedUploadUrl };
});
vi.mock('@/lib/onboarding/operatorStatus', () => ({
  transitionOperatorStatus: mockTransition,
}));

import {
  requestKybUploadUrl,
  listOperatorKybDocs,
  submitForReview,
  KybError,
  type KybPrismaClient,
} from '../kyb';
import { StorageError } from '@/lib/storage';

function makePrisma() {
  const create = vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    id: 'kyb_1',
    operatorId: data.operatorId,
    type: data.type,
    storageKey: data.storageKey,
    status: data.status ?? 'submitted',
    uploadedAt: new Date('2026-06-01T00:00:00.000Z'),
  }));
  const findMany = vi.fn(async () => []);
  return {
    kybDocument: { create, findMany },
  } as unknown as KybPrismaClient & {
    kybDocument: { create: typeof create; findMany: typeof findMany };
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateSignedUploadUrl.mockResolvedValue({
    key: 'kyb_doc/uuid/business_license',
    uploadUrl: 'http://localhost:3001/dev/stub-storage/kyb_doc/uuid?exp=1&sig=abc',
    expiresAt: new Date(),
  });
});

describe('requestKybUploadUrl', () => {
  it('validates type, mints a signed URL, creates a row, returns the result', async () => {
    const prisma = makePrisma();
    const result = await requestKybUploadUrl(prisma, {
      operatorId: 'op_1',
      type: 'business_license',
      contentType: 'application/pdf',
      sizeBytes: 1024,
    });

    expect(mockCreateSignedUploadUrl).toHaveBeenCalledWith(prisma, {
      purpose: 'kyb_doc',
      contentType: 'application/pdf',
      sizeBytes: 1024,
      uploadedBy: 'operator:op_1',
      keyHint: 'business_license',
    });
    expect(prisma.kybDocument.create).toHaveBeenCalledWith({
      data: {
        operatorId: 'op_1',
        type: 'business_license',
        storageKey: 'kyb_doc/uuid/business_license',
        status: 'submitted',
      },
    });
    expect(result).toEqual({
      uploadUrl: 'http://localhost:3001/dev/stub-storage/kyb_doc/uuid?exp=1&sig=abc',
      key: 'kyb_doc/uuid/business_license',
      kybDocumentId: 'kyb_1',
    });
  });

  it('rejects an invalid type with KybError BEFORE any storage/DB call', async () => {
    const prisma = makePrisma();
    await expect(
      requestKybUploadUrl(prisma, {
        operatorId: 'op_1',
        type: 'passport', // not in the documented union
        contentType: 'application/pdf',
        sizeBytes: 1024,
      })
    ).rejects.toMatchObject({ name: 'KybError', code: 'invalid_type' });
    expect(mockCreateSignedUploadUrl).not.toHaveBeenCalled();
    expect(prisma.kybDocument.create).not.toHaveBeenCalled();
  });

  it('surfaces a StorageError (e.g. too_large) from the storage layer', async () => {
    const prisma = makePrisma();
    mockCreateSignedUploadUrl.mockRejectedValueOnce(new StorageError('too_large'));
    await expect(
      requestKybUploadUrl(prisma, {
        operatorId: 'op_1',
        type: 'identity',
        contentType: 'image/png',
        sizeBytes: 999_999_999,
      })
    ).rejects.toBeInstanceOf(StorageError);
    // No row written when the URL mint fails.
    expect(prisma.kybDocument.create).not.toHaveBeenCalled();
  });
});

describe('listOperatorKybDocs', () => {
  it('queries by operatorId, newest first', async () => {
    const prisma = makePrisma();
    await listOperatorKybDocs(prisma, 'op_42');
    expect(prisma.kybDocument.findMany).toHaveBeenCalledWith({
      where: { operatorId: 'op_42' },
      orderBy: { uploadedAt: 'desc' },
    });
  });
});

describe('submitForReview', () => {
  it('calls the 045 transition with to:UNDER_REVIEW and the operator actor', async () => {
    mockTransition.mockResolvedValueOnce({});
    await submitForReview({ operatorId: 'op_7', actor: 'operator:op_7' });
    expect(mockTransition).toHaveBeenCalledWith({
      operatorId: 'op_7',
      to: 'UNDER_REVIEW',
      actor: 'operator:op_7',
    });
  });

  it('propagates an illegal_transition error from the 045 service', async () => {
    const { OperatorStatusError } = await import('../errors');
    mockTransition.mockRejectedValueOnce(new OperatorStatusError('illegal_transition'));
    await expect(
      submitForReview({ operatorId: 'op_8', actor: 'operator:op_8' })
    ).rejects.toMatchObject({ code: 'illegal_transition' });
  });
});
