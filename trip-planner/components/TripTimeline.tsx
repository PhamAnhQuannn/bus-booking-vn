'use client';

// Trip Timeline (V5 Mục 4) — dải node ngang thay khối "Tóm tắt chuyến đi" (peach). Ngữ pháp thị giác
// riêng: mỗi ngày = nhãn tròn N1 + khu vực·số điểm + điểm đầu→cuối. KHÔNG mô tả/giờ/giá (thứ card có).
// Node ngày trong viewport = fill cam-action (sync scroll-spy). Click → scroll tới band ngày. Nét đứt
// nối node = màu signature (đồng bộ route bus/map). Reveal: vẽ nét đứt N1→cuối 1 lần; mobile cuộn ngang.
import { useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type { TimelineNode } from '../lib/planner/timeline';

const TL_CSS = `
.tl-list{ display:flex; align-items:flex-start; gap:0; overflow-x:auto; scroll-snap-type:x proximity; -webkit-overflow-scrolling:touch; padding:2px; scrollbar-width:none; }
.tl-list::-webkit-scrollbar{ display:none; }
.tl-node{ scroll-snap-align:center; display:flex; flex-direction:column; gap:2px; min-width:150px; max-width:220px; padding:8px 10px; border-radius:12px; text-align:left; background:transparent; border:1px solid transparent; cursor:pointer; }
.tl-node:hover{ background:rgba(0,0,0,0.03); }
.tl-node:focus-visible{ outline:2px solid var(--planner-orange-action); outline-offset:2px; }
.tl-circle{ display:grid; place-items:center; width:28px; height:28px; border-radius:9999px; border:1.5px solid #D8D3CA; font-size:13px; font-weight:800; line-height:1; color:var(--planner-text); background:var(--planner-surface); }
.tl-node[aria-current="true"] .tl-circle{ background:var(--planner-orange-action); border-color:var(--planner-orange-action); color:#fff; }
.tl-area{ font-size:13px; font-weight:600; color:var(--planner-text); }
.tl-route{ font-size:13px; color:var(--planner-text-secondary); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.tl-conn{ flex:0 0 auto; align-self:flex-start; margin-top:21px; width:28px; height:0; border-top:2px dashed var(--planner-orange-signature); opacity:.4; }
@keyframes tlDraw{ from{ transform:scaleX(0); } to{ transform:scaleX(1); } }
.tl-draw .tl-conn{ transform-origin:left center; animation:tlDraw .3s ease-out both; animation-delay:calc(var(--i) * .18s); }
@media (prefers-reduced-motion: reduce){ .tl-draw .tl-conn{ animation:none; } }
`;

export function TripTimeline({ nodes, activeDay, onSelectDay }: {
  nodes: TimelineNode[];
  activeDay: number;
  onSelectDay: (day: number) => void;
}) {
  const t = useTranslations('planner');
  const activeRef = useRef<HTMLButtonElement>(null);

  // Mobile cuộn ngang: node ngày active tự căn vào tầm nhìn khi scroll-spy đổi ngày.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }, [activeDay]);

  if (nodes.length === 0) return null;

  return (
    <nav aria-label={t('timeline.navLabel')} className="mx-3 mt-3 rounded-[10px] border border-border bg-[var(--planner-surface)] px-1 py-1.5">
      <style>{TL_CSS}</style>
      <ol className="tl-list tl-draw">
        {nodes.map((n, i) => (
          <li key={n.day} className="flex items-start">
            {i > 0 ? <span className="tl-conn" style={{ ['--i' as string]: i - 1 }} aria-hidden /> : null}
            <button
              ref={n.day === activeDay ? activeRef : undefined}
              type="button"
              onClick={() => onSelectDay(n.day)}
              aria-current={n.day === activeDay ? 'true' : undefined}
              className="tl-node"
            >
              <span className="tl-circle" aria-hidden>{`N${n.day}`}</span>
              <span className="tl-area">
                {n.area ? `${n.area} · ` : ''}{t('timeline.stops', { n: n.stops })}
              </span>
              <span className="tl-route">{n.first === n.last ? n.first : `${n.first} → ${n.last}`}</span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
