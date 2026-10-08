import { describe, it, expect } from 'vitest';
import { formatMoney, rupeesToPaisa, paisaToRupees } from './money';

describe('Money utilities', () => {
  it('formats integer paisa to Nepali Rupee string without floating math', () => {
    expect(formatMoney(120000)).toBe('Rs 1,200.00');
    expect(formatMoney(75000)).toBe('Rs 750.00');
    expect(formatMoney(50)).toBe('Rs 0.50');
    expect(formatMoney(0)).toBe('Rs 0.00');
    expect(formatMoney('360000')).toBe('Rs 3,600.00');
    expect(formatMoney(950000n)).toBe('Rs 9,500.00');
  });

  it('converts Rupee input string or number to integer paisa', () => {
    expect(rupeesToPaisa('1200')).toBe(120000);
    expect(rupeesToPaisa('1200.50')).toBe(120050);
    expect(rupeesToPaisa(1200)).toBe(120000);
    expect(rupeesToPaisa('750')).toBe(75000);
  });

  it('converts paisa to Rupee input string', () => {
    expect(paisaToRupees(120000)).toBe('1200');
    expect(paisaToRupees(120050)).toBe('1200.50');
    expect(paisaToRupees(75000)).toBe('750');
  });
});
