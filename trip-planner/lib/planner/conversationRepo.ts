/**
 * conversationRepo — CRUD lịch sử hội thoại trợ lý (server-only, redesign v4).
 *
 * MỌI hàm nhận customerId và lọc theo owner (where { id, customerId }) → chống IDOR:
 * user A không đọc/sửa/xoá hội thoại của user B (miss owner → 0 row → 404 ở route).
 * Guest KHÔNG dùng repo này (client tự lưu localStorage). dtoJson = snapshot PlannerDto.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/core/db/client';

export interface RepoMessage {
  role: string; // 'user' | 'bot'
  text: string;
  dto?: unknown | null;
}
export interface ConversationMetaRow {
  id: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}
export interface ConversationRow extends ConversationMetaRow {
  messages: RepoMessage[];
}

function toDtoJson(dto: unknown | null | undefined): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return dto == null ? Prisma.JsonNull : (dto as Prisma.InputJsonValue);
}

export async function listConversations(customerId: string): Promise<ConversationMetaRow[]> {
  return prisma.plannerConversation.findMany({
    where: { customerId },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
}

export async function getConversation(customerId: string, id: string): Promise<ConversationRow | null> {
  const c = await prisma.plannerConversation.findFirst({
    where: { id, customerId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
      messages: {
        // Secondary sort on id: createMany stamps every row in a batch with the same createdAt, so a
        // single-key sort left message order nondeterministic (shuffled on reload). replaceMessages
        // now also writes strictly increasing createdAt, but keep the id tiebreak as a backstop. (#528)
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        select: { role: true, text: true, dtoJson: true },
      },
    },
  });
  if (!c) return null;
  return {
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
    messages: c.messages.map((m) => ({ role: m.role, text: m.text, dto: m.dtoJson ?? null })),
  };
}

export async function createConversation(
  customerId: string,
  title: string,
  messages: RepoMessage[],
): Promise<ConversationRow> {
  const c = await prisma.plannerConversation.create({
    data: {
      customerId,
      title: title.slice(0, 200),
      messages: {
        create: messages.map((m) => ({ role: m.role, text: m.text, dtoJson: toDtoJson(m.dto) })),
      },
    },
    select: { id: true, title: true, createdAt: true, updatedAt: true },
  });
  return { ...c, messages };
}

/** Ghi đè toàn bộ messages (replace-all) + bump updatedAt. Trả false nếu không phải owner. */
export async function replaceMessages(customerId: string, id: string, messages: RepoMessage[]): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    // Lock the conversation row FOR UPDATE so two tabs saving the same conversation serialize instead
    // of interleaving delete/create (concurrency rule). Owner-scoped, so a miss (not owner or gone)
    // returns [] → false, same as the old findFirst. Prisma has no FOR UPDATE builder → raw. (#528)
    const owned = await tx.$queryRaw<Array<{ id: string }>>`
      SELECT id FROM "PlannerConversation" WHERE id = ${id} AND "customerId" = ${customerId} FOR UPDATE`;
    if (owned.length === 0) return false;
    await tx.plannerMessage.deleteMany({ where: { conversationId: id } });
    if (messages.length) {
      // Strictly increasing createdAt (base + index ms) so message order is deterministic AND matches
      // insertion order — createMany would otherwise stamp every row with one identical now(). (#528)
      const base = Date.now();
      await tx.plannerMessage.createMany({
        data: messages.map((m, i) => ({
          conversationId: id,
          role: m.role,
          text: m.text,
          dtoJson: toDtoJson(m.dto),
          createdAt: new Date(base + i),
        })),
      });
    }
    await tx.plannerConversation.update({ where: { id }, data: { updatedAt: new Date() } });
    return true;
  });
}

export async function renameConversation(customerId: string, id: string, title: string): Promise<boolean> {
  const r = await prisma.plannerConversation.updateMany({
    where: { id, customerId },
    data: { title: title.slice(0, 200) },
  });
  return r.count > 0;
}

export async function deleteConversation(customerId: string, id: string): Promise<boolean> {
  const r = await prisma.plannerConversation.deleteMany({ where: { id, customerId } });
  return r.count > 0;
}

export async function clearAllConversations(customerId: string): Promise<void> {
  await prisma.plannerConversation.deleteMany({ where: { customerId } });
}
