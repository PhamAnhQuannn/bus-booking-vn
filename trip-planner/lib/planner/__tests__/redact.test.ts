import { describe, it, expect } from 'vitest';
import { redactPii, redactTurns } from '../llm/redact';
import type { ChatTurn } from '../llm/types';

describe('redactPii — mask PII định danh', () => {
  it('mask SĐT VN nhiều dạng', () => {
    expect(redactPii('gọi mình 0912345678 nhé')).toBe('gọi mình [sđt] nhé');
    expect(redactPii('sđt +84 912 345 678')).toBe('sđt [sđt]');
    expect(redactPii('số 0912.345.678')).toBe('số [sđt]');
  });

  it('mask SĐT đọc bằng chữ (có dấu / không dấu / EN / lẫn chữ số)', () => {
    expect(redactPii('liên hệ em qua số không chín không không không không không không hai bốn nhé')).toBe('liên hệ em qua số [sđt] nhé');
    expect(redactPii('sdt khong chin mot hai, ba bon nam, sau bay tam')).toBe('sdt [sđt]');
    expect(redactPii('call zero nine one two three four five six seven eight')).toBe('call [sđt]');
    expect(redactPii('số không 9 1 hai ba 4 năm sáu bảy')).toBe('số [sđt]');
  });

  it('KHÔNG nhầm câu thường có vài từ chữ-số', () => {
    expect(redactPii('đi ba ngày hai đêm, một hai người')).toBe('đi ba ngày hai đêm, một hai người');
    expect(redactPii('nam hai người lớn ba trẻ em')).toBe('nam hai người lớn ba trẻ em');
    expect(redactPii('một hai ba bốn năm sáu bảy tám')).toBe('một hai ba bốn năm sáu bảy tám'); // 8 token < 9
  });

  it('SĐT đọc chữ: idempotent (backfill re-run) + câu thật có nhiều từ chữ-số vẫn nguyên', () => {
    const once = redactPii('số không chín một hai ba bốn năm sáu bảy tám nhé');
    expect(once).toBe('số [sđt] nhé');
    expect(redactPii(once)).toBe(once);
    const ok = 'đi Đà Lạt ba ngày hai đêm, hai người lớn một trẻ em năm tuổi, bảy tám giờ sáng';
    expect(redactPii(ok)).toBe(ok);
    const long = 'không '.repeat(400) + 'x';
    expect(redactPii(long)).toBe('[sđt] x');
  });

  it('mask email', () => {
    expect(redactPii('mail quan.test@example.com đi')).toBe('mail [email] đi');
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

  it('"tên" trần (từ thường) không phải marker — giữ địa danh/tên khách sạn', () => {
    expect(redactPii('điểm đến tên Đà Lạt')).toBe('điểm đến tên Đà Lạt');
    expect(redactPii('khách sạn tên Mường Thanh')).toBe('khách sạn tên Mường Thanh');
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
