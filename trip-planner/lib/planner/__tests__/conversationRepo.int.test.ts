/**
 * Integration tests for conversationRepo (#772) — the owner-scoped persistence for
 * signed-in planner chat had zero coverage. Pins the four properties it must hold on
 * a real Postgres: cross-tenant IDOR isolation, PII scrub on stored user turns,
 * deterministic message ordering (#528), and FOR UPDATE serialization of concurrent
 * replaceMessages.
 *
 * DB-gated — runs in CI / `pnpm vitest:int`, not locally.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '@/lib/core/db/client';
import {
  listConversations,
  getConversation,
  createConversation,
  replaceMessages,
  renameConversation,
  deleteConversation,
  clearAllConversations,
  type RepoMessage,
} from '@/trip-planner/lib/planner/conversationRepo';

let custA = '';
let custB = '';

beforeAll(async () => {
  const a = await prisma.customer.create({ data: { displayName: 'Convo Cust A' } });
  const b = await prisma.customer.create({ data: { displayName: 'Convo Cust B' } });
  custA = a.id;
  custB = b.id;
});

afterAll(async () => {
  await clearAllConversations(custA);
  await clearAllConversations(custB);
  await prisma.customer.deleteMany({ where: { id: { in: [custA, custB] } } });
  await prisma.$disconnect();
});

describe('conversationRepo — PII scrub on stored user turns', () => {
  it('redacts phone/email in user turns but leaves bot turns intact', async () => {
    const created = await createConversation(custA, 'pii', [
      { role: 'user', text: 'gọi 0912345678 mail a@b.com nhé' },
      { role: 'bot', text: 'liên hệ 0912345678' },
    ]);

    const convo = await getConversation(custA, created.id);
    expect(convo).not.toBeNull();
    const [userMsg, botMsg] = convo!.messages;

    expect(userMsg.text).toContain('[sđt]');
    expect(userMsg.text).toContain('[email]');
    expect(userMsg.text).not.toContain('0912345678');
    expect(userMsg.text).not.toContain('a@b.com');

    // Bot turns are server prose — stored verbatim.
    expect(botMsg.text).toBe('liên hệ 0912345678');
  });
});

describe('conversationRepo — cross-tenant IDOR isolation', () => {
  let aConvId = '';

  beforeAll(async () => {
    const c = await createConversation(custA, 'A private', [{ role: 'user', text: 'chuyến của A' }]);
    aConvId = c.id;
  });

  it("customer B cannot read A's conversation", async () => {
    expect(await getConversation(custB, aConvId)).toBeNull();
    expect(await getConversation(custA, aConvId)).not.toBeNull(); // owner still sees it
  });

  it("customer B cannot mutate A's conversation (replace / rename / delete all return false)", async () => {
    expect(await replaceMessages(custB, aConvId, [{ role: 'user', text: 'hijack' }])).toBe(false);
    expect(await renameConversation(custB, aConvId, 'hijacked')).toBe(false);
    expect(await deleteConversation(custB, aConvId)).toBe(false);

    // A's conversation is untouched by B's attempts.
    const convo = await getConversation(custA, aConvId);
    expect(convo?.title).toBe('A private');
    expect(convo?.messages.length).toBe(1);

    // Owner A can mutate it.
    expect(await renameConversation(custA, aConvId, 'A renamed')).toBe(true);
    expect((await getConversation(custA, aConvId))?.title).toBe('A renamed');
  });

  it("B's conversation list never contains A's conversation", async () => {
    const bList = await listConversations(custB);
    expect(bList.some((c) => c.id === aConvId)).toBe(false);
    const aList = await listConversations(custA);
    expect(aList.some((c) => c.id === aConvId)).toBe(true);
  });
});

describe('conversationRepo — deterministic ordering (#528)', () => {
  it('returns messages in insertion order after replaceMessages', async () => {
    const c = await createConversation(custA, 'order', [{ role: 'user', text: 'seed' }]);
    const msgs: RepoMessage[] = [0, 1, 2, 3, 4].map((i) => ({ role: i % 2 ? 'bot' : 'user', text: `m${i}` }));
    expect(await replaceMessages(custA, c.id, msgs)).toBe(true);

    const convo = await getConversation(custA, c.id);
    expect(convo!.messages.map((m) => m.text)).toEqual(['m0', 'm1', 'm2', 'm3', 'm4']);
  });
});

describe('conversationRepo — concurrent replaceMessages serialize (FOR UPDATE)', () => {
  it('two concurrent writers leave one complete set, never an interleaved/partial one', async () => {
    const c = await createConversation(custA, 'race', [{ role: 'user', text: 'seed' }]);
    const setX: RepoMessage[] = [
      { role: 'user', text: 'x0' },
      { role: 'bot', text: 'x1' },
      { role: 'user', text: 'x2' },
    ];
    const setY: RepoMessage[] = [
      { role: 'user', text: 'y0' },
      { role: 'bot', text: 'y1' },
    ];

    const [rx, ry] = await Promise.all([
      replaceMessages(custA, c.id, setX),
      replaceMessages(custA, c.id, setY),
    ]);
    expect(rx).toBe(true);
    expect(ry).toBe(true);

    const texts = (await getConversation(custA, c.id))!.messages.map((m) => m.text);
    // Exactly one writer's set survives, whole — no interleave, no duplication.
    const isX = JSON.stringify(texts) === JSON.stringify(['x0', 'x1', 'x2']);
    const isY = JSON.stringify(texts) === JSON.stringify(['y0', 'y1']);
    expect(isX || isY).toBe(true);
  });
});
