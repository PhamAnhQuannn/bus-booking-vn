'use client';

/**
 * Lưu/đọc lịch sử hội thoại trợ lý — 1 interface, 2 nguồn (redesign v4):
 *  - Đã đăng nhập  → gọi API /api/planner/conversations qua authFetch (Bearer+CSRF, đồng bộ đa thiết bị).
 *  - Guest         → localStorage key 'bbvn_planner_convos' (per-device; upsell "Đăng nhập" để sync).
 * Cùng shape trả về nên PlannerSidebar không cần phân biệt nguồn. Client-safe (không import server).
 *
 * Chuẩn hoá timestamp về epoch-ms ở cả 2 nguồn (API trả ISO string → Date.parse).
 */

import { authFetch, getAccessToken } from '@/lib/auth/clientSession';
import type { PlannerDto } from '@/trip-planner/lib/planner/itineraryDto';

export interface StoredMsg {
  role: 'user' | 'bot';
  text: string;
  dto?: PlannerDto | null;
}
export interface Conversation {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messages: StoredMsg[];
}
export interface ConversationMeta {
  id: string;
  title: string;
  updatedAt: number;
}

const LS_KEY = 'bbvn_planner_convos';
const MAX_LOCAL = 30; // chặn phình localStorage

function authed(): boolean {
  return getAccessToken() !== null;
}

/** Cắt ~60 ký tự làm tiêu đề, deterministic (không LLM). */
export function deriveTitle(firstUserText: string): string {
  const t = firstUserText.trim().replace(/\s+/g, ' ');
  return t.length > 60 ? t.slice(0, 57).trimEnd() + '…' : t || 'Cuộc trò chuyện mới';
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `c_${Date.now()}_${Math.floor(Math.random() * 1e9)}`;
}

// ── localStorage (guest) ────────────────────────────────────────────────────
function readLocal(): Conversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    return Array.isArray(raw) ? (raw as Conversation[]) : [];
  } catch {
    return [];
  }
}
function writeLocal(list: Conversation[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list.slice(0, MAX_LOCAL)));
  } catch {
    /* quota — bỏ qua */
  }
}
function toMeta(c: Conversation): ConversationMeta {
  return { id: c.id, title: c.title, updatedAt: c.updatedAt };
}

// ── API (authed) ────────────────────────────────────────────────────────────
type ApiConvo = { id: string; title: string; createdAt: string; updatedAt: string; messages?: StoredMsg[] };
function normalize(c: ApiConvo): Conversation {
  return {
    id: c.id,
    title: c.title,
    createdAt: Date.parse(c.createdAt),
    updatedAt: Date.parse(c.updatedAt),
    messages: c.messages ?? [],
  };
}

// ── public API — dispatch theo trạng thái đăng nhập ─────────────────────────

export async function listConversations(): Promise<ConversationMeta[]> {
  if (authed()) {
    const res = await authFetch('/api/planner/conversations');
    if (!res.ok) return [];
    const json = (await res.json()) as { conversations: ApiConvo[] };
    return json.conversations.map((c) => ({ id: c.id, title: c.title, updatedAt: Date.parse(c.updatedAt) }));
  }
  return readLocal()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .map(toMeta);
}

export async function getConversation(id: string): Promise<Conversation | null> {
  if (authed()) {
    const res = await authFetch(`/api/planner/conversations/${id}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { conversation: ApiConvo };
    return normalize(json.conversation);
  }
  return readLocal().find((c) => c.id === id) ?? null;
}

export async function createConversation(title: string, messages: StoredMsg[]): Promise<Conversation> {
  if (authed()) {
    const res = await authFetch('/api/planner/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, messages }),
    });
    const json = (await res.json()) as { conversation: ApiConvo };
    return normalize(json.conversation);
  }
  const now = Date.now();
  const convo: Conversation = { id: newId(), title, createdAt: now, updatedAt: now, messages };
  writeLocal([convo, ...readLocal()]);
  return convo;
}

/** Ghi ĐÈ toàn bộ messages của 1 hội thoại (replace-all — đồng nhất API + localStorage). */
export async function saveMessages(id: string, messages: StoredMsg[]): Promise<void> {
  if (authed()) {
    await authFetch(`/api/planner/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages }),
    });
    return;
  }
  const list = readLocal();
  const c = list.find((x) => x.id === id);
  if (!c) return;
  c.messages = messages;
  c.updatedAt = Date.now();
  writeLocal([c, ...list.filter((x) => x.id !== id)]);
}

export async function renameConversation(id: string, title: string): Promise<void> {
  if (authed()) {
    await authFetch(`/api/planner/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title }),
    });
    return;
  }
  const list = readLocal();
  const c = list.find((x) => x.id === id);
  if (c) {
    c.title = title;
    writeLocal(list);
  }
}

export async function deleteConversation(id: string): Promise<void> {
  if (authed()) {
    await authFetch(`/api/planner/conversations/${id}`, { method: 'DELETE' });
    return;
  }
  writeLocal(readLocal().filter((c) => c.id !== id));
}

export async function clearAllConversations(): Promise<void> {
  if (authed()) {
    await authFetch('/api/planner/conversations', { method: 'DELETE' });
    return;
  }
  writeLocal([]);
}
