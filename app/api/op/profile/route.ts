/**
 * GET /api/op/profile  — 200 { phone, contactPhone, notificationPhone, displayName, requiresPasswordChange }
 * PATCH /api/op/profile — update { contactPhone?, notificationPhone?, displayName? }
 *
 * Both blocked by requireOperatorAuth (default: not allowed during password change).
 *
 * PATCH errors:
 *   400 INVALID_PHONE     — phone fails VN format validation
 *   409 PHONES_MUST_DIFFER — contactPhone === notificationPhone after update
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/core/db/client';
import { verifyOperatorAccess } from '@/lib/auth';
import { PatchOperatorProfileSchema } from '@/lib/auth';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { normalizePhone } from '@/lib/core/validation/phone';
import { PhoneNormalizeError } from '@/lib/core/validation/phone';
import { Prisma } from '@prisma/client';

const ACCESS_COOKIE = 'bb_op_access';

async function getOperatorFromToken(
  cookieStore: Awaited<ReturnType<typeof cookies>>
): Promise<{ id: string } | null> {
  const tokenCookie = cookieStore.get(ACCESS_COOKIE);
  if (!tokenCookie?.value) return null;
  const payload = await verifyOperatorAccess(tokenCookie.value);
  if (!payload) return null;
  return { id: payload.sub };
}

async function getHandler(req: NextRequest): Promise<Response> {
  const cookieStore = await cookies();
  const identity = await getOperatorFromToken(cookieStore);
  if (!identity) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const user = await prisma.operatorUser.findUnique({
    where: { id: identity.id },
    select: {
      phone: true,
      contactPhone: true,
      notificationPhone: true,
      displayName: true,
      requiresPasswordChange: true,
      disabledAt: true,
    },
  });

  if (!user || user.disabledAt !== null) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (user.requiresPasswordChange) {
    return NextResponse.json({ error: 'PASSWORD_CHANGE_REQUIRED' }, { status: 403 });
  }

  return NextResponse.json({
    phone: user.phone,
    contactPhone: user.contactPhone,
    notificationPhone: user.notificationPhone,
    displayName: user.displayName,
    requiresPasswordChange: user.requiresPasswordChange,
  });
}

async function patchHandler(req: NextRequest): Promise<Response> {
  const cookieStore = await cookies();
  const identity = await getOperatorFromToken(cookieStore);
  if (!identity) return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });

  const user = await prisma.operatorUser.findUnique({
    where: { id: identity.id },
    select: {
      contactPhone: true,
      notificationPhone: true,
      displayName: true,
      requiresPasswordChange: true,
      disabledAt: true,
    },
  });

  if (!user || user.disabledAt !== null) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (user.requiresPasswordChange) {
    return NextResponse.json({ error: 'PASSWORD_CHANGE_REQUIRED' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  const parsed = PatchOperatorProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 });
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'INVALID' }, { status: 400 });
  }

  // Normalize phones if provided
  let normalizedContact = user.contactPhone;
  let normalizedNotification = user.notificationPhone;

  try {
    if (updates.contactPhone) normalizedContact = normalizePhone(updates.contactPhone);
    if (updates.notificationPhone) normalizedNotification = normalizePhone(updates.notificationPhone);
  } catch (err) {
    if (err instanceof PhoneNormalizeError) {
      return NextResponse.json({ error: 'INVALID_PHONE' }, { status: 400 });
    }
    throw err;
  }

  // contactPhone and notificationPhone must differ
  if (normalizedContact === normalizedNotification) {
    return NextResponse.json({ error: 'PHONES_MUST_DIFFER' }, { status: 409 });
  }

  try {
    await prisma.operatorUser.update({
      where: { id: identity.id },
      data: {
        ...(updates.contactPhone ? { contactPhone: normalizedContact } : {}),
        ...(updates.notificationPhone ? { notificationPhone: normalizedNotification } : {}),
        ...(updates.displayName ? { displayName: updates.displayName } : {}),
      },
    });
  } catch (err) {
    // DB CHECK constraint "OperatorUser_phones_differ" may fire
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      return NextResponse.json({ error: 'PHONES_MUST_DIFFER' }, { status: 409 });
    }
    throw err;
  }

  return new NextResponse(null, { status: 204 });
}

export const GET = withErrorHandler(getHandler);
export const PATCH = withErrorHandler(patchHandler);
