import { describe, it, expect } from 'vitest';
import { redactPii, redactTurns } from '../llm/redact';
import type { ChatTurn } from '../llm/types';

describe('redactPii — mask PII định danh', () => {
  it('mask SĐT VN nhiều dạng', () => {
    expect(redactPii('gọi mình 0912345678 nhé')).toBe('gọi mình [sđt] nhé');
    expect(redactPii('sđt +84 912 345 678')).toBe('sđt [sđt]');
    expect(redactPii('số 0912.345.678')).toBe('số [sđt]');
  });

  it('mask email', () => {
    expect(redactPii('mail quan.pham@gmail.com đi')).toBe('mail [email] đi');
  });

  it('mask CCCD/CMND đứng độc lập', () => {
    expect(redactPii('cccd 012345678901')).toBe('cccd [cccd]'); // 12 số
    expect(redactPii('cmnd 241234567')).toBe('cmnd [cccd]'); // 9 số không bắt đầu 0
  });

  it('CMND 9 số bắt đầu 0 vẫn bị ẩn (dạng phone) — miễn không lộ', () => {
    expect(redactPii('cmnd 012345678')).not.toContain('012345678');
  });

  it('mask tên tự khai (marker-anchored)', () => {
    expect(redactPii('tên tôi là Quân')).toBe('tên tôi là [tên]');
    expect(redactPii('mình tên Nguyễn Văn A')).toBe('mình tên [tên]');
    expect(redactPii('họ và tên: Trần Bình')).toBe('họ và tên: [tên]');
    expect(redactPii('my name is John Smith')).toBe('my name is [tên]');
  });

  it('GIỮ địa danh — không nuke tên riêng địa lý', () => {
    expect(redactPii('đi Sa Pa 3 ngày')).toBe('đi Sa Pa 3 ngày');
    expect(redactPii('Bến Tre 2 đêm')).toBe('Bến Tre 2 đêm');
    expect(redactPii('leo Sơn Trà rồi ra Hội An')).toBe('leo Sơn Trà rồi ra Hội An');
  });

  it('GIỮ tín hiệu intent (party/thời lượng/sở thích)', () => {
    expect(redactPii('đi với vợ 2 con')).toBe('đi với vợ 2 con');
    expect(redactPii('3 ngày 2 đêm thích biển')).toBe('3 ngày 2 đêm thích biển');
    expect(redactPii('ngân sách 3 triệu')).toBe('ngân sách 3 triệu');
  });

  it('không đụng khối số dài (mã vé/order-id) không phải SĐT', () => {
    expect(redactPii('mã vé 20260921123456789')).toBe('mã vé 20260921123456789');
  });
});

describe('redactTurns — chỉ user-turn, model-turn giữ nguyên', () => {
  it('scrub user, giữ nguyên model + sig', () => {
    const turns: ChatTurn[] = [
      { role: 'user', text: 'đi Sa Pa, gọi 0912345678' },
      { role: 'model', text: 'Bạn muốn đi mấy ngày?', sig: 'abc123' },
    ];
    const out = redactTurns(turns);
    expect(out[0]).toEqual({ role: 'user', text: 'đi Sa Pa, gọi [sđt]' });
    expect(out[1]).toEqual({ role: 'model', text: 'Bạn muốn đi mấy ngày?', sig: 'abc123' });
  });
});
