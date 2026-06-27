import { expect } from 'vitest';

import {
  FORBIDDEN_RESPONSE_FIELDS,
  flattenKeys,
} from '@/lib/security/__tests__/forbiddenFields';

export function expectNoForbiddenFields(body: unknown): void {
  const keys = flattenKeys(body);
  const forbidden = keys.filter((key) =>
    FORBIDDEN_RESPONSE_FIELDS.some(
      (field) => key === field || key.endsWith(`.${field}`),
    ),
  );

  expect(forbidden).toEqual([]);
}

export { FORBIDDEN_RESPONSE_FIELDS, flattenKeys };
