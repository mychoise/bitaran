import { isDateOnly, nepalToday } from './date.util.js';

describe('nepalToday', () => {
  afterEach(() => jest.useRealTimers());

  it.each([
    // Nepal is UTC+05:45: the Kathmandu date rolls over at 18:15 UTC.
    ['2026-10-27T18:14:59Z', '2026-10-27'],
    ['2026-10-27T18:15:00Z', '2026-10-28'],
    ['2026-12-31T20:00:00Z', '2027-01-01'],
    ['2026-01-01T00:00:00Z', '2026-01-01'],
  ])('at %s UTC returns %s', (utc, expected) => {
    jest.useFakeTimers({ now: new Date(utc) });
    expect(nepalToday()).toBe(expected);
  });
});

describe('isDateOnly', () => {
  it.each(['2026-10-28', '2028-02-29'])('accepts %s', (v) => {
    expect(isDateOnly(v)).toBe(true);
  });
  it.each([
    '2026-02-30',
    '2026-13-01',
    '2026-1-01',
    '28-10-2026',
    '',
    20261028,
  ])('rejects %p', (v) => {
    expect(isDateOnly(v)).toBe(false);
  });
});

describe('nepalToday(at)', () => {
  it('uses the Nepal calendar day, not the UTC one', () => {
    // 20:00 UTC is 01:45 the next day in Nepal (UTC+5:45).
    expect(nepalToday(new Date('2026-10-27T20:00:00Z'))).toBe('2026-10-28');
    expect(nepalToday(new Date('2026-10-27T18:14:59Z'))).toBe('2026-10-27');
  });
});
