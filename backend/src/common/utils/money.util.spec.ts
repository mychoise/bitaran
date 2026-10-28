import { assertIntegerPaisa, multiplyPaisa, sumPaisa } from './money.util.js';

describe('money utils', () => {
  it.each([0, 1, -500, 123_456_789])('accepts integer paisa %p', (v) => {
    expect(() => assertIntegerPaisa(v)).not.toThrow();
  });

  it.each([1.5, NaN, Infinity, '100', null, undefined, 2 ** 53])(
    'rejects %p',
    (v) => {
      expect(() => assertIntegerPaisa(v, 'price')).toThrow(
        /price must be an integer paisa/,
      );
    },
  );

  it('sums integers and rejects any float', () => {
    expect(sumPaisa([100, 250, -50])).toBe(300);
    expect(sumPaisa([])).toBe(0);
    expect(() => sumPaisa([100, 0.5])).toThrow(/values\[1\]/);
  });

  it('multiplies unit price by integer quantity', () => {
    expect(multiplyPaisa(2000, 30)).toBe(60_000);
    expect(() => multiplyPaisa(2000, 1.5)).toThrow(/quantity/);
    expect(() => multiplyPaisa(2 ** 52, 4)).toThrow(/lineTotal/);
  });
});
