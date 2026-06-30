import { mean, median, quantile, stddev, pearson, iqrBounds, linearTrend, skewness } from '../engine/stats';

describe('stats', () => {
  it('mean / median / quantile', () => {
    expect(mean([1, 2, 3, 4])).toBe(2.5);
    expect(median([1, 2, 3, 4, 5])).toBe(3);
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5);
  });
  it('sample stddev', () => {
    expect(stddev([2, 4, 4, 4, 5, 5, 7, 9])).toBeCloseTo(2.138, 2);
    expect(stddev([5])).toBe(0);
  });
  it('pearson: perfect, none, negative', () => {
    expect(pearson([1, 2, 3], [2, 4, 6])).toBeCloseTo(1, 6);
    expect(pearson([1, 2, 3], [3, 2, 1])).toBeCloseTo(-1, 6);
    expect(pearson([1, 1, 1], [1, 2, 3])).toBe(0); // no variance -> 0, not NaN
  });
  it('iqrBounds flags the right fences', () => {
    const b = iqrBounds([1, 2, 3, 4, 5, 6, 7, 8, 100], 1.5);
    expect(100 > b.upper).toBe(true);
  });
  it('linearTrend slope is positive for rising data', () => {
    expect(linearTrend([0, 1, 2, 3], [10, 20, 30, 40]).slope).toBeCloseTo(10, 6);
  });
  it('skewness is positive for a right tail', () => {
    expect(skewness([1, 1, 2, 2, 3, 100])).toBeGreaterThan(0);
  });
});
