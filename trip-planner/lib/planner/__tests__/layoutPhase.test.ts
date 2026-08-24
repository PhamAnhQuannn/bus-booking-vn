import { describe, it, expect } from 'vitest';
import { deriveLayoutPhase } from '../layoutPhase';

describe('deriveLayoutPhase — pha bố cục suy ra', () => {
  it('phiên rỗng → idle', () =>
    expect(deriveLayoutPhase({ messageCount: 0, hasDto: false, isGenerating: false, planned: false })).toBe('idle'));

  it('có tin, chưa plan/generating → collecting', () =>
    expect(deriveLayoutPhase({ messageCount: 1, hasDto: false, isGenerating: false, planned: false })).toBe('collecting'));

  it('đang generating (trước khi dto về) → planning', () =>
    expect(deriveLayoutPhase({ messageCount: 2, hasDto: false, isGenerating: true, planned: false })).toBe('planning'));

  it('bot msg mang dto → planning', () =>
    expect(deriveLayoutPhase({ messageCount: 3, hasDto: true, isGenerating: false, planned: false })).toBe('planning'));

  it('latch sticky giữ planning dù dto tạm vắng', () =>
    expect(deriveLayoutPhase({ messageCount: 3, hasDto: false, isGenerating: false, planned: true })).toBe('planning'));

  it('idle precedence — messageCount 0 override latch cũ', () =>
    expect(deriveLayoutPhase({ messageCount: 0, hasDto: false, isGenerating: false, planned: true })).toBe('idle'));
});
