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
## 2026-08-22 - Optimization for array search

**Learning:** When searching an array for multiple distinct elements, multiple `.find()` calls iterate the array multiple times. A single-pass loop (using a `for` loop) is significantly faster, reducing overhead especially for larger arrays. If only a specific subset of matches are expected, extracting these variables directly in a single pass with early breakouts (`break`) when all targets are matched gives a noticeable performance boost over multiple O(N) traversals. Using an object dictionary `{}` inside a hot loop can be surprisingly slow in v8 due to allocation overhead compared to primitive variables for small fixed numbers of search targets.

**Action:** When finding 2-3 specific distinct elements in an array, use a single `for` loop with multiple variables and early breakouts instead of chaining `.find()`, but balance readability and scope. Ensure the overhead is justified by the hot path context.
