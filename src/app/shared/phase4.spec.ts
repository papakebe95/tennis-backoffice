import { describe, expect, it } from 'vitest';
import { formatMoney } from './format';

describe('formatMoney', () => {
  it('shows whole francs with local grouping', () => {
    expect(formatMoney(60000, 'fr').replace(/\s/g, ' ')).toBe('60 000 FCFA');
    expect(formatMoney('1234567.4', 'en')).toBe('1,234,567 FCFA');
  });

  it('shows a dash when there is no amount', () => {
    expect(formatMoney(null, 'fr')).toBe('—');
    expect(formatMoney('', 'fr')).toBe('—');
  });

  it('keeps other currencies explicit', () => {
    expect(formatMoney(12, 'en', 'EUR')).toBe('12 EUR');
  });
});
