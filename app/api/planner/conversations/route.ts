/**
 * /api/planner/conversations — lịch sử hội thoại trợ lý (redesign v4). Bearer auth (customer).
 *   GET    → { conversations: [{id,title,createdAt,updatedAt}] }  (owner, mới nhất trước)
 *   POST   { title, messages? } → 201 { conversation }
 *   DELETE → 204  (xoá toàn bộ của owner — "Xoá lịch sử trò chuyện")
 * Guest KHÔNG gọi route này (client lưu localStorage). CSRF ở proxy cho POST/DELETE.
 */

export const runtime = 'nodejs';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { withErrorHandler } from '@/lib/withErrorHandler';
import { requireCustomerAuth } from '@/lib/auth';
import { listConversations, createConversation, clearAllConversations } from '@/trip-planner/lib/planner';

const messageSchema = z.object({
  role: z.enum(['user', 'bot']),
  text: z.string().max(8000),
  dto: z.unknown().optional(),
});
const createSchema = z.object({
  title: z.string().min(1).max(200),
  messages: z.array(messageSchema).max(200).optional(),
});

export const GET = withErrorHandler(
  requireCustomerAuth()(async (_req, { customerId }) => {
    const conversations = await listConversations(customerId);
    return NextResponse.json({ conversations });
  }),
);

export const POST = withErrorHandler(
  requireCustomerAuth()(async (req: NextRequest, { customerId }) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'INVALID' }, { status: 400 });
    }
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: 'INVALID' }, { status: 400 });
    const conversation = await createConversation(customerId, parsed.data.title, parsed.data.messages ?? []);
    return NextResponse.json({ conversation }, { status: 201 });
  }),
);

export const DELETE = withErrorHandler(
  requireCustomerAuth()(async (_req, { customerId }) => {
    await clearAllConversations(customerId);
    return new NextResponse(null, { status: 204 });
  }),
);
