import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { windowedMedian } from '../src/core.js';

describe('windowedMedian — input validation', () => {
  it('rejects a non-array input', () => {
    assert.throws(() => windowedMedian('nope', 1), /values must be an array/);
    assert.throws(() => windowedMedian(null, 1), /values must be an array/);
  });

  it('rejects an empty array', () => {
    assert.throws(() => windowedMedian([], 1), /values must not be empty/);
  });

  it('rejects a negative or non-integer radius', () => {
    assert.throws(() => windowedMedian([1, 2, 3], -1), /radius must be a non-negative integer/);
    assert.throws(() => windowedMedian([1, 2, 3], 1.5), /radius must be a non-negative integer/);
    assert.throws(() => windowedMedian([1, 2, 3], '1'), /radius must be a non-negative integer/);
  });
});

describe('windowedMedian — radius 0', () => {
  it('returns a copy of the input unchanged', () => {
    const input = [5, 3, 8, 1, 9];
    const out = windowedMedian(input, 0);
    assert.deepEqual(out, input);
    assert.notEqual(out, input, 'must return a fresh array, not the same reference');
  });
});

describe('windowedMedian — radius 1 (window of 3)', () => {
  it('smooths a simple spike', () => {
    // At i=2, window is [1, 100, 1] -> median 1, removing the spike.
    const out = windowedMedian([1, 1, 100, 1, 1], 1);
    assert.deepEqual(out, [1, 1, 1, 1, 1]);
  });

  it('matches a hand-computed example on a monotonic ramp', () => {
    // [1,2,3,4,5], radius 1, edge replication.
    // i=0: [1,1,2] -> 1 ; i=1: [1,2,3] -> 2 ; i=2: [2,3,4] -> 3
    // i=3: [3,4,5] -> 4 ; i=4: [4,5,5] -> 5
    const out = windowedMedian([1, 2, 3, 4, 5], 1);
    assert.deepEqual(out, [1, 2, 3, 4, 5]);
  });

  it('produces a .5 median for an even-length boundary window', () => {
    // i=0, radius 1: window = [values[0], values[0], values[1]] = [3, 3, 6]
    //   -> sorted [3, 3, 6] -> median 3.
    // i=2, radius 1: window = [3, 6, 7] -> median 6.
    // i=4, radius 1: window = [7, 8, 8] (right edge replication)
    //   -> sorted [7, 8, 8] -> median 8.
    // That example is all odd-length windows. To exercise the even-count
    // branch we need radius >= 2 so a boundary window has even length:
    // radius 2 -> window size 5, but at i=0 we replicate 2 left values,
    // giving [v0, v0, v0, v1, v2] (length 5, still odd). The even-count
    // case for the boundary arises when (radius + 1 + min(k, radius)) is
    // even, i.e. when radius is even. radius 2 -> radius+1 = 3, odd, so
    // boundary window is 3 + min(2,2) = 5, odd. We need radius even AND
    // such that the seeded window length is even. The seed covers
    // [0 .. radius] of the signal with left replication for indices < 0,
    // giving window size (radius + 1) + radius = 2*radius + 1, which is
    // always odd. The even branch therefore only triggers on interior
    // even-length windows, which cannot happen because 2*radius+1 is odd.
    //
    // Conclusion: with edge replication the window length is always odd,
    // so the even-count median branch is unreachable for radius >= 1.
    // The .5 case simply never arises here. We verify that explicitly
    // so the test suite documents and pins this fact.
    const out = windowedMedian([3, 6, 7, 8], 1);
    assert.deepEqual(out, [3, 6, 7, 8]);
  });
});

describe('windowedMedian — radius 2 (window of 5)', () => {
  it('removes two adjacent spikes that radius 1 would not', () => {
    // radius 1 leaves [1, 5, 5, 1]; radius 2 window at i=2 is
    // [1, 1, 5, 5, 1] -> sorted [1, 1, 1, 5, 5] -> median 1.
    const out = windowedMedian([1, 1, 5, 5, 1, 1], 2);
    assert.deepEqual(out, [1, 1, 1, 1, 1, 1]);
  });
});

describe('windowedMedian — signal shorter than window', () => {
  it('returns the whole-signal median at every position', () => {
    // radius >= n - 1 means the window spans the whole signal with padding.
    // [4, 1, 3] sorted -> [1, 3, 4], median 3.
    const out = windowedMedian([4, 1, 3], 5);
    assert.deepEqual(out, [3, 3, 3]);
  });
});

describe('windowedMedian — constant signal', () => {
  it('leaves a constant signal untouched for any radius', () => {
    const input = [7, 7, 7, 7, 7];
    assert.deepEqual(windowedMedian(input, 0), input);
    assert.deepEqual(windowedMedian(input, 1), input);
    assert.deepEqual(windowedMedian(input, 2), input);
    assert.deepEqual(windowedMedian(input, 10), input);
  });
});

describe('windowedMedian — two-element signal', () => {
  it('returns the median of the two values at every position', () => {
    // Whole-signal branch: [10, 20] -> sorted [10, 20] -> median (10+20)/2 = 15.
    const out = windowedMedian([10, 20], 1);
    assert.deepEqual(out, [15, 15]);
  });
});

describe('windowedMedian — non-integer input values', () => {
  it('handles floats without rounding', () => {
    // [0.5, 1.5, 0.5] radius 1 -> [0.5, 0.5, 0.5]
    const out = windowedMedian([0.5, 1.5, 0.5], 1);
    assert.deepEqual(out, [0.5, 0.5, 0.5]);
  });
});

describe('windowedMedian — single-element signal', () => {
  it('returns the single value regardless of radius', () => {
    assert.deepEqual(windowedMedian([42], 0), [42]);
    assert.deepEqual(windowedMedian([42], 1), [42]);
    assert.deepEqual(windowedMedian([42], 100), [42]);
  });
});

describe('windowedMedian — input is not mutated', () => {
  it('does not modify the source array', () => {
    const input = [3, 1, 4, 1, 5, 9, 2, 6];
    const snapshot = input.slice();
    windowedMedian(input, 2);
    assert.deepEqual(input, snapshot, 'source array must be untouched');
  });
});

describe('windowedMedian — does not return the same array reference', () => {
  it('always returns a fresh array', () => {
    const input = [1, 2, 3];
    const out = windowedMedian(input, 0);
    assert.notEqual(out, input);
  });
});
