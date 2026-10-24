/**
 * Core implementation of a sliding window median filter.
 *
 * Window edge policy: "same" padding via edge value replication. We made
 * this one decision deliberately — the output always has the same length
 * as the input. "valid"-style shrinking outputs are not supported, and no
 * padding mode other than edge replication is offered. The reason is that
 * picking a single, predictable boundary behaviour keeps the surface area
 * small and the tests honest; supporting several padding rules invites
 * exactly the kind of half-implemented ambiguity this library is designed
 * to avoid.
 */

/**
 * Computes the median of a non-empty, low-to-high sorted array of numbers.
 *
 * We avoid the spread operator and Array.prototype.slice here so that the
 * function can operate on an internal buffer that may be longer than the
 * portion we want the median of — `end` is exclusive.
 *
 * @param {number[]} sorted A non-empty array, sorted ascending.
 * @param {number} end Exclusive upper index. Must be >= 1.
 * @returns {number} The median.
 */
function medianOfSorted(sorted, end) {
  const count = end;
  const mid = count >> 1;
  if ((count & 1) === 1) {
    return sorted[mid];
  }
  // Even count: arithmetic mean of the two middle elements. For integer
  // signals this can produce a .5 value, which is the correct median by
  // definition. Callers who need strictly-integer outputs should round
  // downstream; this library does not hide the .5 from them.
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Computes a windowed median of `values` with a sliding window of total
 * size 2*radius + 1, using edge-value replication at the boundaries.
 *
 * Edge value replication means that near the start of the signal, the
 * missing positions to the left are treated as if they held `values[0]`,
 * and near the end the missing right-hand positions hold
 * `values[length - 1]`. This makes the output length match the input
 * length exactly.
 *
 * Implementation note: rather than re-sorting the full window at every
 * step (an O(n * k * log k) cost), we maintain a sorted window in a
 * plain array with insertion-sort-style maintenance: at each step we
 * remove the element sliding out of the window and insert the new one
 * sliding in. This is O(n * k) which is better for the small windows
 * typical of 1-D signal denoising, and keeps the code dependency-free.
 *
 * @param {number[]} values Input signal. Must be non-empty.
 * @param {number} radius Half-width of the window. The window covers
 *   indices [i - radius, i + radius] around each output index `i`. Must
 *   be a non-negative integer.
 * @returns {number[]} Filtered signal, same length as `values`.
 */
export function windowedMedian(values, radius) {
  if (!Array.isArray(values)) {
    throw new TypeError('values must be an array');
  }
  if (values.length === 0) {
    throw new Error('values must not be empty');
  }
  if (!Number.isInteger(radius) || radius < 0) {
    throw new Error('radius must be a non-negative integer');
  }

  const n = values.length;

  // radius 0: no filtering, each output equals its input.
  if (radius === 0) {
    return values.slice();
  }

  // When the window is wider than the entire signal, every position sees
  // the full signal with edge padding; the result is the median of the
  // whole array for every output slot. Sorting a copy once is cheaper
  // and avoids any pathological maintenance work below.
  if (radius >= n - 1) {
    const sortedAll = values.slice().sort((a, b) => a - b);
    const m = medianOfSorted(sortedAll, n);
    const out = new Array(n);
    for (let i = 0; i < n; i++) out[i] = m;
    return out;
  }

  const windowSize = 2 * radius + 1;
  const sorted = new Array(windowSize);
  let sortedLen = 0;

  /** Insert `x` into the sorted array, keeping ascending order. */
  function insert(x) {
    let lo = 0;
    let hi = sortedLen;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    // Shift elements at index >= lo one position right to make room.
    for (let i = sortedLen; i > lo; i--) sorted[i] = sorted[i - 1];
    sorted[lo] = x;
    sortedLen++;
  }

  /** Remove the first occurrence of `x` from the sorted array. */
  function remove(x) {
    let lo = 0;
    let hi = sortedLen;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (sorted[mid] < x) lo = mid + 1;
      else hi = mid;
    }
    // `lo` is now the index of the first element >= x. Because the
    // element is guaranteed to exist (it was inserted earlier), and the
    // array has no duplicates beyond what the input contains, sorted[lo]
    // equals x. Shift the tail left to close the gap.
    for (let i = lo; i < sortedLen - 1; i++) sorted[i] = sorted[i + 1];
    sortedLen--;
    // Wipe the now-stale tail slot so we never read stale data by accident.
    sorted[sortedLen] = undefined;
  }

  const out = new Array(n);

  // Seed the sorted window for index 0: it contains the left-replicated
  // edge value (radius copies of values[0]) followed by values[1..radius].
  for (let i = 0; i <= radius; i++) insert(values[0]);
  for (let i = 1; i <= radius; i++) insert(values[i]);

  out[0] = medianOfSorted(sorted, sortedLen);

  // Slide the window one step at a time. Between consecutive centres,
  // exactly one element leaves (the value at `centre - radius - 1`, or
  // the edge value while still inside the left padding zone) and one
  // element enters (the value at `centre + radius`, or the right edge
  // value once we enter the right padding zone).
  for (let centre = 1; centre < n; centre++) {
    const leftIdx = centre - radius - 1;
    const rightIdx = centre + radius;

    const leaving = leftIdx < 0 ? values[0] : values[leftIdx];
    const entering = rightIdx >= n ? values[n - 1] : values[rightIdx];

    // When the window is stationary at the right edge, `leaving` and
    // `entering` can be the same value; removing and re-inserting it
    // is harmless and keeps the loop branch-free.
    remove(leaving);
    insert(entering);

    out[centre] = medianOfSorted(sorted, sortedLen);
  }

  return out;
}
