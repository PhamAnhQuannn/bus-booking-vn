// Setup project: ghi fixture KB tổng hợp cho các suite planner CẦN data (happy/ssr/map).
// Chạy TRƯỚC (playwright dependencies). Skip-nếu-đã-có (không đè data thật). guard suite KHÔNG cần.
import { test as setup } from '@playwright/test';
import { writeExport } from './helpers/planner-fixtures';

setup('write planner KB fixtures', async () => {
  writeExport('da-lat', { n: 12, regions: 2, tam: { lat: 11.94, lon: 108.44 } });   // đủ cho lịch 3 ngày
  writeExport('mong-cai', { n: 3, regions: 1, tam: { lat: 21.53, lon: 107.96 } });  // THIN -> test S4 header-honesty
});
