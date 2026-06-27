import { DealProcessingUtils } from '../../../src/common/deal-processing.utils.js';

describe('DealProcessingUtils.computePriceDrop', () => {
  it('returns the amount and rounded percentage for a genuine drop', () => {
    const drop = DealProcessingUtils.computePriceDrop(100, 75);

    expect(drop).toEqual({
      previousPrice: 100,
      currentPrice: 75,
      amount: 25,
      percentage: 25,
    });
  });

  it('rounds the percentage to two decimals', () => {
    // 30 -> 20 is a 33.333...% drop
    const drop = DealProcessingUtils.computePriceDrop(30, 20);

    expect(drop?.percentage).toBe(33.33);
  });

  it('treats a price reaching zero as a 100% drop', () => {
    expect(DealProcessingUtils.computePriceDrop(50, 0)).toMatchObject({
      amount: 50,
      percentage: 100,
    });
  });

  it('returns null when the price rises or is unchanged', () => {
    expect(DealProcessingUtils.computePriceDrop(75, 100)).toBeNull();
    expect(DealProcessingUtils.computePriceDrop(100, 100)).toBeNull();
  });

  it('returns null when either price is missing', () => {
    expect(DealProcessingUtils.computePriceDrop(null, 50)).toBeNull();
    expect(DealProcessingUtils.computePriceDrop(50, undefined)).toBeNull();
  });

  it('returns null when the previous price is non-positive (no meaningful %)', () => {
    expect(DealProcessingUtils.computePriceDrop(0, -5)).toBeNull();
  });
});
