## 2026-08-08 - Array allocation optimization

**Learning:** Reducing passes over nested arrays by manually unrolling `map` and `reduce` combinations and avoiding creating intermediate array allocations with functional constructs, instead using typed arrays (`Float64Array`) and single-pass iteration (`for` loops), provides substantial and consistent performance improvements across large nested datasets (up to ~3.5x improvement).

**Action:** Whenever performance profiling indicates that functional chaining of array operations (`.map().reduce()`) is hot on large datasets or inside frequent calculations, prefer allocating typed arrays once and manually looping. Also, refactor loops to avoid function call overhead for primitives like `Math.min()`.
## 2024-06-13 - Bulk Upsert Optimization

**Learning:** When pushing data arrays to an API (like Supabase `upsert`), transforming an N+1 sequence of individual requests into a single network operation reduces latency, limits round trips, and mitigates the browser's concurrency limits on outgoing parallel connections.

**Action:** Whenever looping over data to issue a network request, investigate whether the receiving API supports bulk operations (e.g., Supabase passing an array of rows to `upsert`). If supported, refactor to bulk actions to enhance speed and reliability.
## 2025-02-05 - Array.find() optimization inside hot loops
**Learning:** `Array.prototype.find()` inside hot loops mapping arrays over elements is a significant performance drain in JavaScript/TypeScript engines compared to direct array indexed lookups and/or plain `for` loops.
**Action:** When searching small, static domains inside large loops (e.g. associating categories or mapping items to ranges), prefer `O(1)` precalculated array lookups (e.g., mapping `lookup[index]`) or a simple linear scan using a standard `for` loop over array elements over the `.find()` method. Doing so decreases CPU overhead, cutting execution time by nearly 25-30% on critical paths for millions of rows.
## 2024-05-18 - Optimized `normalizeCiudad` department string parsing

**Learning:** When looping over static array definitions (like an array of valid department names) and calculating dynamic properties inside the loop based on the static data (such as getting the word length via `.split(' ').length`), performance takes a considerable hit. Especially on high iteration counts.
**Action:** Precalculate properties based on static structures instead of calling dynamic operators inside loops that use those structures.
**Learning:** Chained array methods like `.map().filter()` create intermediate arrays which causes redundant iterations and garbage collection pressure.
**Action:** When extracting data for analysis (e.g. valid weights), use a single manual `for...of` loop or `.reduce()` to iterate the array exactly once and minimize allocations.
## 2025-02-18 - Optimized Dashboard Metrics Count Function

**Learning:** O(M * N) filtering checks across large arrays are extremely slow in Javascript, especially when mapping and filtering inside `map()`. Building a temporary lookup/frequency map in O(N) drastically improves performance.
**Action:** When calculating statistics or histograms for array items across many records, use a single-pass `for` loop to increment counters in a `Map` or plain object, handling inner-array deduplication directly. This reduced the dashboard aggregation time for the `count` helper from ~60ms down to ~19ms for 100k items.
## 2025-02-18 - Single-Pass Data Aggregation

**Learning:** Redundant iterations (`O(N)`) over data collections for aggregating multiple metrics can cause significant CPU overhead, especially as datasets grow.

**Action:** Consolidate multiple `filter` and mapping passes into a single iteration where multiple state variables or counters are updated simultaneously to maximize cache locality and reduce raw loop overhead.
