## 2026-09-26 - Optimized `iccBinary` for Array Passes Overhead
**Learning:** Found multiple array passes utilizing `.filter()` followed by `.reduce()` passes that increased Garbage Collection pressure via transient array creations. V8 does better with simpler, single or double pass `for` loops than multiple sequential functional combinators on hot paths.
**Action:** Transformed `iccBinary` to eliminate `groups.filter()` and its successive `.reduce()` statements into two explicit, pre-optimized `for` loops, bypassing allocations and providing a ~4-80x speedup when benchmarking large structures. Will keep applying this methodology for high-frequency or data-heavy array aggregations in TypeScript/JavaScript contexts where speed is crucial.
## 2024-05-24 - Single Pass for Multiple Summations

**Learning:** When calculating multiple summations over an array (e.g. sums of terms or powers of terms used in statistical formulas like Cochran-Armitage or variance), `Array.prototype.reduce()` requires one pass per reduction. If these reductions are separate statements, it causes N passes over the entire array. Using a single `for` loop to compute all summations in parallel significantly reduces the iteration overhead.

**Action:** For performance optimization in tight or hot code paths, combine multiple reductions (`.reduce()` or similar array methods) into a single standard `for` loop to compute all running totals in O(N) instead of O(N * number_of_reductions).
