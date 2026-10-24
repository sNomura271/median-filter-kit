/**
 * Public entry point for median-filter-kit.
 *
 * Re-exports the single filtering routine so consumers depend on the
 * package root, not on internal module paths.
 */
export { windowedMedian } from './core.js';
