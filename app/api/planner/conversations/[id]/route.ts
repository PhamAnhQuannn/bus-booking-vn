/**
 * /api/planner/conversations/[id] — 1 hội thoại trợ lý (redesign v4). Bearer auth (customer).
 *   GET    → { conversation } | 404          (kèm messages, owner-scoped)
 *   PATCH  { title? , messages? } → 200 | 404  (đổi tên và/hoặc ghi đè messages)
 *   DELETE → 204 | 404                        (xoá 1 hội thoại)
 * Owner-scoped ở repo (where {id, customerId}) → miss owner = 404 (chống IDOR).
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { requireCustomerAuth } from '@/lib/auth';
import { getConversation, replaceMessages, renameConversation, deleteConversation } from '@/trip-planner/lib/planner';

type Ctx = { params: Promise<{ id: string }> };

const messageSchema = z.object({
  role: z.enum(['user', 'bot']),
  text: z.string().max(8000),
  dto: z.unknown().optional(),
});
const patchSchema = z
  .object({
    title: z.string().min(1).max(200).optional(),
    messages: z.array(messageSchema).max(200).optional(),
  })
  .refine((b) => b.title !== undefined || b.messages !== undefined, { message: 'EMPTY' });

export async function GET(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  return withErrorHandler(
    requireCustomerAuth()(async (_req, { customerId }) => {
      const conversation = await getConversation(customerId, id);
      if (!conversation) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
      return NextResponse.json({ conversation });
    }),
  )(req);
}

export async function PATCH(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  return withErrorHandler(
    requireCustomerAuth()(async (r: NextRequest, { customerId }) => {
      let body: unknown;
      try {
        body = await r.json();
      } catch {
        return NextResponse.json({ error: 'INVALID' }, { status: 400 });
      }
      const parsed = patchSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 });

      let ok = true;
      if (parsed.data.title !== undefined) ok = await renameConversation(customerId, id, parsed.data.title);
      if (ok && parsed.data.messages !== undefined) ok = await replaceMessages(customerId, id, parsed.data.messages);
      if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
      return NextResponse.json({ ok: true });
    }),
  )(req);
}

export async function DELETE(req: NextRequest, ctx: Ctx): Promise<Response> {
  const { id } = await ctx.params;
  return withErrorHandler(
    requireCustomerAuth()(async (_req, { customerId }) => {
      const ok = await deleteConversation(customerId, id);
      if (!ok) return NextResponse.json({ error: 'NOT_FOUND' }, { status: 404 });
      return new NextResponse(null, { status: 204 });
    }),
  )(req);
}
