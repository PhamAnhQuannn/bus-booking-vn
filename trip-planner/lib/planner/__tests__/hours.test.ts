import { describe, it, expect } from 'vitest';
import { buildScheduleDetail, compressDays } from '../hours';

describe('buildScheduleDetail — chỉ trả chi tiết khi giờ khác nhau', () => {
  it('đồng nhất cả tuần → null', () => {
    const sched = [{ days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'], open: '08:00', close: '17:30' }];
    expect(buildScheduleDetail(sched)).toBeNull();
  });

  it('2 khung cùng giờ → null (không cần chi tiết)', () => {
    const sched = [{ days: ['monday'], open: '08:00', close: '17:00' }, { days: ['tuesday'], open: '08:00', close: '17:00' }];
    expect(buildScheduleDetail(sched)).toBeNull();
  });

  it('giờ khác theo ngày → cấu trúc ngày ISO', () => {
    const sched = [
      { days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'], open: '08:00', close: '17:00' },
      { days: ['saturday', 'sunday'], open: '08:00', close: '21:00' },
    ];
    expect(buildScheduleDetail(sched)).toEqual([
      { d: [1, 2, 3, 4, 5], open: '08:00', close: '17:00' },
      { d: [6, 7], open: '08:00', close: '21:00' },
    ]);
  });

  it('1 khung / rỗng → null', () => {
    expect(buildScheduleDetail([{ days: ['monday'], open: '08:00', close: '17:00' }])).toBeNull();
    expect(buildScheduleDetail([])).toBeNull();
    expect(buildScheduleDetail(undefined)).toBeNull();
  });
});

describe('compressDays — gom ngày liên tiếp', () => {
  it('[1,2,3,4,5] → [[1,5]]', () => expect(compressDays([1, 2, 3, 4, 5])).toEqual([[1, 5]]));
  it('[1,2,6,7] → [[1,2],[6,7]]', () => expect(compressDays([1, 2, 6, 7])).toEqual([[1, 2], [6, 7]]));
  it('[3] → [[3,3]]', () => expect(compressDays([3])).toEqual([[3, 3]]));
});
