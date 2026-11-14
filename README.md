# median-filter-kit

Applies a sliding window median filter to one-dimensional signal data for noise reduction. Exports a single function, `windowedMedian(values, radius)`, which returns a new array the same length as the input.

```js
import { windowedMedian } from 'median-filter-kit';

// Remove a single-sample spike from an otherwise flat signal.
const cleaned = windowedMedian([1, 1, 100, 1, 1], 1);
// -> [1, 1, 1, 1, 1]
```

`values` must be a non-empty array of numbers. `radius` must be a non-negative integer; the window around each output index `i` covers `[i - radius, i + radius]`, so the window size is `2 * radius + 1`.

## Why this exists

A median filter is the standard tool for removing isolated spikes (shot noise) from a 1-D signal while preserving edges, which a moving average would blur. The trade-off here is deliberate smallness: the library does one window shape (symmetric), one edge policy (edge-value replication), and nothing else. If you need "valid"-style shrinking output, asymmetric windows, or multiple padding modes, that is a different library.

## The edge you will hit

Edge handling is the one ambiguous decision in a median filter. This library replicates the boundary value: near the start, missing left-hand window positions are treated as `values[0]`; near the end, missing right-hand positions are treated as `values[length - 1]`. The output length always equals the input length. When `radius` is greater than or equal to `values.length - 1`, every output position is the median of the entire signal.

Because the window is always `2 * radius + 1` samples wide, it is always odd-length, so the median is always a single element of the input — the even-count (mean-of-two-middles) branch only matters for the whole-signal case, where `values.length` is even, in which case the output is the arithmetic mean of the two middle values (which may be a `.5` value).

## Performance

The window keeps a bounded buffer, so `push` is constant time and memory does not
grow with the length of the stream. `peak` and `trough` are linear in the window
size, which is the trade that keeps `push` cheap.

## Design notes

The window stores values eagerly rather than keeping running aggregates. Running
sums drift with floating point over long streams, and recomputing from a small
buffer is cheap enough that the drift is not worth the speed.

## Contributing

Issues and pull requests are welcome. Please keep the dependency list empty —
that constraint is the point of the project, not an oversight.

