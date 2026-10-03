## 2026-09-26 - Optimized `iccBinary` for Array Passes Overhead
**Learning:** Found multiple array passes utilizing `.filter()` followed by `.reduce()` passes that increased Garbage Collection pressure via transient array creations. V8 does better with simpler, single or double pass `for` loops than multiple sequential functional combinators on hot paths.
**Action:** Transformed `iccBinary` to eliminate `groups.filter()` and its successive `.reduce()` statements into two explicit, pre-optimized `for` loops, bypassing allocations and providing a ~4-80x speedup when benchmarking large structures. Will keep applying this methodology for high-frequency or data-heavy array aggregations in TypeScript/JavaScript contexts where speed is crucial.

## 2024-05-18 - Dictionary Mapping Overhead in V8 vs TypeScript Idiomatics
**Learning:** While adopting `new Map()` over `Object.create(null)` is considered idiomatic in TypeScript for dictionaries, V8's fast-path properties for null-prototype objects in tight counting loops (`O(1)` allocations) can outperform hashing string keys in a Map for small/medium vocabulary sizes. In text analysis applications, replacing `Object.create(null)` with `new Map()` incurs a minor 8-15% execution penalty for typical payloads, although `Map` remains semantically safer and correctly types values.
**Action:** Always measure code changes against established baselines (via Vitest bench) when replacing fast-paths with idiomatic structures. Document the explicit trade-off of raw execution speed vs syntactic idiom in the PR body to provide context.
## 2025-02-18 - Hoisting regexes out of hot loops

**Learning:** Repeatedly creating regex objects from literals in hot loops (even with global flags) has a non-negligible cost. Furthermore, iterating over long string arrays can cause many unnecessary `.toLowerCase()` and `.split(/\s+/)` string allocations if not guarded by early-exit conditions.
**Action:** When acting as a performance optimization agent (Bolt), always check for string allocations inside loops, look for opportunities to short-circuit iteration (`break` or `return`), and hoist reusable `RegExp` objects out of functions entirely (to module scope).
## 2026-09-06 - Testing gap on error paths

**Learning:** When code catches exceptions, a single test that asserts the same fallback value for both "caught an exception" and "got an error response from an API" conflates two distinct scenarios.
**Action:** Write granular test cases that independently verify different failure conditions (e.g., throwing vs. returning an error), to ensure that refactoring doesn't break one of those specific paths silently.

## 2024-05-18 - Optimized mapping arrays by pre-computing multipliers
**Learning:** Checking `totalOcc > 0` and dividing values by it inside `.map()` arrays leads to redundant branches and repetitive floating-point division in hot loops.
**Action:** When computing percentages for an array iteratively, pre-compute the percentage multiplier using a ternary operator (e.g., `const factor = total > 0 ? 1 / total : 0`) before the `.map()` loop, and then perform a simple multiplication (`value * factor`) instead of repeating the branch condition and division. This eliminates redundant checks inside iteration and speeds up execution.

## 2025-02-12 - Sync array transformation and UPSERT chunking
**Learning:** Chained `.filter().map()` operations on large arrays (like surveys) result in O(N*M) complexity overheads and increase memory allocations/GC pressure. Furthermore, attempting to bulk-upsert unbounded arrays of data to a database (like Supabase) can trigger network payload limits, timeouts, and affect I/O stability.
**Action:** Replace multi-pass array methods with a single-pass `for` loop pre-allocating the resulting array (`new Array(len)`), falling back to `rows.length = count` to trim. Add `.slice()` chunking (e.g. 500 records) to network UPSERT calls, wrapped in `Promise.all()` to keep requests parallelized without exceeding limits.
## 2025-02-18 - Optimize Duplicate Discovery with Memoized O(1) Lookups

**Learning:** When searching for duplicates across a dataset that is frequently validated against (e.g., during form interactions or keystrokes), repeatedly executing array `.find()` loops over the existing list results in significant O(N) CPU overhead. Grouping items by their composite key in a Map turns subsequent lookups into O(1). Because the source array instance (e.g., `Survey[]`) might be stable across these repeated validation calls (as long as it wasn't modified), a `WeakMap` is perfectly suited to cache the derived lookup structure against the source array reference, enabling zero-rebuild fast paths.

**Action:** Whenever implementing linear searches over relatively large local datasets for composite keys—especially in functions heavily called within the render cycle or during form validation—always consider transforming the search into an O(1) `Map` lookup and caching that map via `WeakMap` keyed on the exact dataset array instance.

## 2025-02-18 - Optimize IndexedDB writes/deletes batching
**Learning:** For bulk writes or deletes in IndexedDB using the `idb` library, mapping individual `.put()` or `.delete()` calls to an array of promises wrapped in `Promise.all()` introduces unnecessary microtask overhead and intermediate array allocations.
**Action:** Initiate standard transaction operations within a synchronous loop (`for...of`) and await `tx.done` at the end to minimize memory allocations and garbage collection pressure in V8/browser environments.
## 2024-05-18 - Optimize Loop Conditions over Array Searching
**Learning:** For extremely tight, hot loops parsing large arrays, replacing generic JavaScript array helper methods like `.find()` with direct index access bounded by sequential `if/else` checks removes function callback overhead and avoids generic array iteration.
**Action:** When a known finite set of bounds must be checked repeatedly in an unrolled loop, replace `array.find(cond)` with `if (val >= min && val <= max) out = array[idx];` to secure an O(1) direct lookup that improves CPU performance by roughly ~7%.

## 2024-05-18 - Optimize Loop Conditions over Array Searching
**Learning:** For extremely tight, hot loops parsing large arrays, replacing generic JavaScript array helper methods like `.find()` with direct index access bounded by sequential `if/else` checks removes function callback overhead and avoids generic array iteration.
**Action:** When a known finite set of bounds must be checked repeatedly in an unrolled loop, replace `array.find(cond)` with `if (val >= min && val <= max) out = array[idx];` to secure an O(1) direct lookup that improves CPU performance by roughly ~7%.
