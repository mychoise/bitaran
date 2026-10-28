import { randomUUID } from 'node:crypto';
import {
  newStorageKey,
  parseStorageKey,
  STORAGE_CATEGORIES,
} from './storage-key.js';

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('storage keys', () => {
  const businessId = randomUUID();

  it.each(STORAGE_CATEGORIES)(
    'are {businessId}/%s/{uuid} with no extension',
    (category) => {
      const key = newStorageKey(businessId, category);
      const [biz, cat, id, ...rest] = key.split('/');
      expect([biz, cat, rest]).toEqual([businessId, category, []]);
      expect(id).toMatch(UUID_V4);
      expect(parseStorageKey(key)).toEqual({ businessId, category, id });
    },
  );

  it('are unique', () => {
    const keys = new Set(
      Array.from({ length: 100 }, () => newStorageKey(businessId, 'logos')),
    );
    expect(keys.size).toBe(100);
  });

  it('refuse a business id that is not a uuid', () => {
    expect(() => newStorageKey('../etc', 'logos')).toThrow(/businessId/);
  });

  it.each([
    `${businessId}/logos/${randomUUID()}.jpg`,
    `${businessId}/secrets/${randomUUID()}`,
    `${businessId}/logos`,
    `${businessId}/logos/${randomUUID()}/x`,
    `../${businessId}/logos/${randomUUID()}`,
    `${businessId}/../logos/${randomUUID()}`,
    `/${businessId}/logos/${randomUUID()}`,
    `${businessId.toUpperCase()}/logos/${randomUUID()}`,
    '',
  ])('parse rejects %p', (key) => {
    expect(parseStorageKey(key)).toBeNull();
  });
});
