'use client';

/**
 * ProgressStages — checklist 4 giai đoạn cho pha `building`. KHÔNG progress bar %.
 * Stage 1 (Phân tích) tick NGAY (đã qua bước phân tích khi vào building). Stage 2/3 theo TIMER
 * ước lượng (40%/70% thời gian dựng trung bình, lưu localStorage 5 lần gần nhất; fallback 18s).
 * Stage 4 (ước tính chi phí) CHỈ tick khi kết quả thật về (`settled`) → không bao giờ tự xong.
 * Response sớm hơn timer → fast-forward toàn bộ trong 600ms rồi để page vào reveal.
 *
 * a11y: vùng có role="status" + aria-live="polite" (mirror=false) đọc giai đoạn mới mỗi lần đổi.
 * mirror=true → bản thu gọn (aria-hidden, không live region) đặt ở cuối panel skeleton.
 *
 * INVARIANT: chỉ nói TIẾN TRÌNH hệ thống — KHÔNG fact địa điểm.
 */

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';

const LS_KEY = 'bb-planner-build-ms';
const FALLBACK_MS = 18000;

function readAvg(): number {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    if (Array.isArray(arr) && arr.length) {
      const nums = arr.filter((x) => typeof x === 'number' && x > 0);
      if (nums.length) return Math.min(45000, Math.max(4000, nums.reduce((a, b) => a + b, 0) / nums.length));
    }
  } catch {
    /* storage chặn/parse lỗi → fallback */
  }
  return FALLBACK_MS;
}
function pushDuration(ms: number) {
  try {
    const arr = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    const nums = (Array.isArray(arr) ? arr : []).filter((x) => typeof x === 'number');
    nums.push(ms);
    localStorage.setItem(LS_KEY, JSON.stringify(nums.slice(-5)));
  } catch {
    /* bỏ qua nếu storage chặn */
  }
}

type Props = { active: boolean; settled: boolean; destination: string; mirror?: boolean };

export function ProgressStages({ active, settled, destination, mirror }: Props) {
  const t = useTranslations('planner');
  // stage = số giai đoạn ĐÃ xong (0..4). Mount khi vào building → initial = 1 (Phân tích xong).
  // Component remount mỗi lần build (parent chỉ render khi buildingView) nên KHÔNG cần reset trong effect.
  const [stage, setStage] = useState(1);
  const startRef = useRef<number>(0);

  // Timer stage 2/3 (setTimeout = setState async → không cascading; dùng performance.now trong effect).
  useEffect(() => {
    if (!active) return;
    startRef.current = performance.now();
    const avg = readAvg();
    const t2 = setTimeout(() => setStage((s) => Math.max(s, 2)), avg * 0.4);
    const t3 = setTimeout(() => setStage((s) => Math.max(s, 3)), avg * 0.7);
    return () => { clearTimeout(t2); clearTimeout(t3); };
  }, [active]);

  // Kết quả thật về → fast-forward về xong (600ms) + ghi thời lượng để timer tự hiệu chỉnh.
  useEffect(() => {
    if (!active || !settled) return;
    if (startRef.current) pushDuration(performance.now() - startRef.current);
    const t3 = setTimeout(() => setStage((s) => Math.max(s, 3)), 0);
    const t4 = setTimeout(() => setStage(4), 600);
    return () => { clearTimeout(t3); clearTimeout(t4); };
  }, [active, settled]);

  const rows = [
    t('progress.analyze'),
    t('progress.findSpots', { destination }),
    t('progress.route'),
    t('progress.cost'),
  ];
  const activeIdx = Math.min(stage, 3); // hàng đang chạy (stage<4)

  if (mirror) {
    // Bản thu gọn: chỉ 1 dòng giai đoạn đang chạy (aria-hidden — bản chính đã announce).
    return (
      <p aria-hidden className="px-1 py-2 text-[13px] text-muted-foreground">
        <span className="mr-1.5 inline-block motion-safe:animate-spin">◌</span>
        {stage >= 4 ? rows[3] : rows[activeIdx]}
      </p>
    );
  }

  return (
    <div role="status" aria-live="polite" className="mt-2 rounded-2xl border border-[#F0EAE2] bg-white/70 p-3 text-[13px]">
      <ul className="flex flex-col gap-1.5">
        {rows.map((label, i) => {
          const done = i < stage;
          const running = i === stage && stage < 4;
          return (
            <li key={i} className={`flex items-center gap-2 ${done ? 'text-foreground' : running ? 'text-foreground' : 'text-muted-foreground'}`}>
              <span aria-hidden className={`grid size-4 shrink-0 place-items-center ${done ? 'text-primary' : ''}`}>
                {done ? '✓' : running ? <span className="motion-safe:animate-spin">◌</span> : '○'}
              </span>
              <span className={done || running ? 'font-medium' : ''}>{label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default ProgressStages;
