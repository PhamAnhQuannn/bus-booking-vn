import { describe, it, expect } from 'vitest';

import { band, trustMetric, TRUST_FLOOR } from '../trustDisplay';

describe('band (round-down friendly number)', () => {
  it('shows small counts exactly, no plus', () => {
    expect(band(28)).toBe('28');
    expect(band(99)).toBe('99');
  });

  it('floors to nearest 100 with a plus at/above 100', () => {
    expect(band(100)).toBe('100+');
    expect(band(540)).toBe('500+');
    expect(band(999)).toBe('900+');
  });

  it('groups thousands with vi-VN separator, rounding down', () => {
    expect(band(1240)).toBe('1.200+');
    expect(band(1299)).toBe('1.200+');
  });

  it('never rounds up', () => {
    // 199 must not become "200+"
    expect(band(199)).toBe('100+');
  });
});

describe('trustMetric (threshold gate)', () => {
  it('shows the number when at/above floor', () => {
    expect(trustMetric(28, TRUST_FLOOR.routes, 'tuyến', 'Nhiều tuyến')).toEqual({
      value: '28',
      label: 'tuyến',
    });
  });

  it('falls back to qualitative copy below floor', () => {
    expect(trustMetric(3, TRUST_FLOOR.operators, 'nhà xe', 'Nhiều nhà xe toàn quốc')).toEqual({
      label: 'Nhiều nhà xe toàn quốc',
    });
  });

  it('treats exactly the floor as above (≥, not >)', () => {
    expect(trustMetric(20, 20, 'tuyến', 'fallback').value).toBe('20');
  });
});
