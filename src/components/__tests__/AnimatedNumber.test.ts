import { formatSignedAmount, formatWithCommas } from '../AnimatedNumber';

describe('formatWithCommas', () => {
  it('groups digits into thousands with commas', () => {
    expect(formatWithCommas(12345)).toBe('12,345');
    expect(formatWithCommas(1234567)).toBe('1,234,567');
  });

  it('leaves numbers under 1000 unformatted', () => {
    expect(formatWithCommas(0)).toBe('0');
    expect(formatWithCommas(999)).toBe('999');
  });

  it('formats negative numbers with a leading minus, comma-grouped', () => {
    expect(formatWithCommas(-500)).toBe('-500');
    expect(formatWithCommas(-12345)).toBe('-12,345');
  });

  it('rounds non-integer input before formatting', () => {
    expect(formatWithCommas(199.6)).toBe('200');
    expect(formatWithCommas(199.4)).toBe('199');
  });
});

describe('formatSignedAmount', () => {
  it('prepends "+" for positive values when signed', () => {
    expect(formatSignedAmount(50, true)).toBe('+50');
    expect(formatSignedAmount(1500, true)).toBe('+1,500');
  });

  it('prepends "+" for exactly zero when signed (push shows "+0")', () => {
    expect(formatSignedAmount(0, true)).toBe('+0');
  });

  it('does not double up a sign for negative values when signed — the minus already comes from formatWithCommas', () => {
    expect(formatSignedAmount(-50, true)).toBe('-50');
  });

  it('never adds a sign when not signed, regardless of value', () => {
    expect(formatSignedAmount(50, false)).toBe('50');
    expect(formatSignedAmount(0, false)).toBe('0');
    expect(formatSignedAmount(-50, false)).toBe('-50');
  });
});
