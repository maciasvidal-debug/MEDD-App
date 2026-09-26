## 2025-02-18 - Hoisting regexes out of hot loops

**Learning:** Repeatedly creating regex objects from literals in hot loops (even with global flags) has a non-negligible cost. Furthermore, iterating over long string arrays can cause many unnecessary `.toLowerCase()` and `.split(/\s+/)` string allocations if not guarded by early-exit conditions.
**Action:** When acting as a performance optimization agent (Bolt), always check for string allocations inside loops, look for opportunities to short-circuit iteration (`break` or `return`), and hoist reusable `RegExp` objects out of functions entirely (to module scope).
## 2026-09-06 - Testing gap on error paths

**Learning:** When code catches exceptions, a single test that asserts the same fallback value for both "caught an exception" and "got an error response from an API" conflates two distinct scenarios.
**Action:** Write granular test cases that independently verify different failure conditions (e.g., throwing vs. returning an error), to ensure that refactoring doesn't break one of those specific paths silently.
## 2024-09-26 - Single-Pass Option Extraction

**Learning:** When extracting multiple distinct option arrays from a list of objects in React `useMemo` hooks, chaining `.map().filter()` causes O(N) multi-pass iterations and large array allocations. For V8 environments, fusing these operations into a single loop mapping to multiple `Set` objects provides a substantial performance boost (e.g. 2.33x faster) by avoiding intermediate array instantiations and reducing iteration count.

**Action:** Whenever identifying multiple `useMemo` loops performing `.map().filter()` chains over the same array to extract unique values, combine them into a single `for` loop that populates multiple `Set` objects simultaneously. Destructure the returned sorted arrays.
## 2026-09-26 - Optimized `iccBinary` for Array Passes Overhead
**Learning:** Found multiple array passes utilizing `.filter()` followed by `.reduce()` passes that increased Garbage Collection pressure via transient array creations. V8 does better with simpler, single or double pass `for` loops than multiple sequential functional combinators on hot paths.
**Action:** Transformed `iccBinary` to eliminate `groups.filter()` and its successive `.reduce()` statements into two explicit, pre-optimized `for` loops, bypassing allocations and providing a ~4-80x speedup when benchmarking large structures. Will keep applying this methodology for high-frequency or data-heavy array aggregations in TypeScript/JavaScript contexts where speed is crucial.
