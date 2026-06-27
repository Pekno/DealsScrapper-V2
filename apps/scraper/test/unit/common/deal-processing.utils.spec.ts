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

describe('DealProcessingUtils.crossedBelowThreshold', () => {
  it('fires only on the transition from at-or-above to strictly below', () => {
    // 100 (>= 80) -> 70 (< 80): the edge
    expect(DealProcessingUtils.crossedBelowThreshold(100, 70, 80)).toBe(true);
  });

  it('treats a price sitting exactly on the threshold as not-yet-crossed', () => {
    // previous == threshold counts as "above"; current == threshold is not "below"
    expect(DealProcessingUtils.crossedBelowThreshold(80, 80, 80)).toBe(false);
    expect(DealProcessingUtils.crossedBelowThreshold(100, 80, 80)).toBe(false);
  });

  it('does not re-fire while the price stays below (oscillation under threshold)', () => {
    // 70 -> 60, both already below 80: no fresh crossing
    expect(DealProcessingUtils.crossedBelowThreshold(70, 60, 80)).toBe(false);
  });

  it('does not fire when the price stays at or above the threshold', () => {
    expect(DealProcessingUtils.crossedBelowThreshold(100, 90, 80)).toBe(false);
  });

  it('does not fire on a first sighting (no previous) even if already cheap', () => {
    expect(DealProcessingUtils.crossedBelowThreshold(null, 50, 80)).toBe(false);
  });

  it('returns false when current price or threshold is missing', () => {
    expect(DealProcessingUtils.crossedBelowThreshold(100, null, 80)).toBe(false);
    expect(DealProcessingUtils.crossedBelowThreshold(100, 70, undefined)).toBe(false);
  });
});
