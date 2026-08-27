/**
 * Layout mỏng cho /tro-ly-du-lich — CHỈ để đặt document.title theo ngữ cảnh
 * ("Trợ lý du lịch | BBVN") vì page là 'use client' nên không export metadata được.
 * Trả thẳng children (không bọc DOM/provider) → không đổi render.
 */
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('planner');
  return { title: t('metadata.assistantTitle') };
}

export default function TroLyDuLichLayout({ children }: { children: React.ReactNode }) {
  return children;
}
