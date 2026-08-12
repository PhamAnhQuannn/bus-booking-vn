/**
 * Nội dung khởi động màn mở đầu trợ lý (redesign entry v4). Tách khỏi page để dữ liệu-hoá:
 *  - VIBE_STARTERS: 4 chip "Gợi ý bắt đầu" — bấm → gửi câu free-text (qua /api/planner/chat).
 *  - SAMPLE_CARDS: 3 card "Bạn có thể thử..." — ảnh thật CC-licensed (public/destinations/*).
 * Client-safe (không import server) — PlannerEntry deep-import trực tiếp.
 */

export interface VibeStarter {
  label: string;
  icon: string; // emoji placeholder (mock dùng line-icon; thay sau nếu cần)
  query: string; // câu gửi cho trợ lý khi bấm chip
}

export interface SampleCard {
  title: string;
  desc: string;
  prompt: string; // câu gửi cho trợ lý khi bấm card
  image: string; // path ảnh placeholder dưới public/
}

export const VIBE_STARTERS: VibeStarter[] = [
  { label: 'Đi nghỉ dưỡng cuối tuần', icon: '🏖️', query: 'Gợi ý cho mình một chuyến nghỉ dưỡng cuối tuần' },
  { label: 'Đi du lịch cùng gia đình', icon: '👨‍👩‍👧', query: 'Gợi ý chuyến du lịch cùng gia đình có trẻ nhỏ' },
  { label: 'Đi phượt khám phá', icon: '🧭', query: 'Gợi ý một chuyến phượt khám phá' },
  { label: 'Du lịch nước ngoài', icon: '🌏', query: 'Mình muốn đi du lịch nước ngoài' },
];

export const SAMPLE_CARDS: SampleCard[] = [
  {
    title: 'Lên kế hoạch Đà Lạt 3 ngày 2 đêm',
    desc: 'Gợi ý lịch trình, điểm tham quan, ăn uống và chi phí ước tính.',
    prompt: 'Lên kế hoạch Đà Lạt 3 ngày 2 đêm',
    image: '/destinations/da-lat.jpg',
  },
  {
    title: 'Đi Nha Trang cuối tuần',
    desc: 'Tư vấn lịch trình 2 ngày 1 đêm, nhà xe, khách sạn và địa điểm vui chơi.',
    prompt: 'Nha Trang cuối tuần 2 ngày 1 đêm cho 2 người',
    image: '/destinations/nha-trang.jpg',
  },
  {
    title: 'Hành trình Sài Gòn – Đà Nẵng',
    desc: 'Gợi ý lịch trình 4 ngày 3 đêm, điểm đến nổi bật và chi phí hợp lý.',
    prompt: 'Hành trình Sài Gòn đi Đà Nẵng 4 ngày 3 đêm',
    image: '/destinations/da-nang.jpg',
  },
];
