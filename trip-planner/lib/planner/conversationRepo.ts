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
        orderBy: { createdAt: 'asc' },
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
    const owned = await tx.plannerConversation.findFirst({ where: { id, customerId }, select: { id: true } });
    if (!owned) return false;
    await tx.plannerMessage.deleteMany({ where: { conversationId: id } });
    if (messages.length) {
      await tx.plannerMessage.createMany({
        data: messages.map((m) => ({ conversationId: id, role: m.role, text: m.text, dtoJson: toDtoJson(m.dto) })),
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
