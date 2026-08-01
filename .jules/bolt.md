## 2024-06-12 - Optimize chiSquareTest function

**Learning:** Reducing passes over nested arrays by manually unrolling `map` and `reduce` combinations and avoiding creating intermediate array allocations with functional constructs, instead using typed arrays (`Float64Array`) and single-pass iteration (`for` loops), provides substantial and consistent performance improvements across large nested datasets (up to ~3.5x improvement).

**Action:** Whenever performance profiling indicates that functional chaining of array operations (`.map().reduce()`) is hot on large datasets or inside frequent calculations, prefer allocating typed arrays once and manually looping. Also, refactor loops to avoid function call overhead for primitives like `Math.min()`.
## 2024-06-13 - Bulk Upsert Optimization

**Learning:** When pushing data arrays to an API (like Supabase `upsert`), transforming an N+1 sequence of individual requests into a single network operation reduces latency, limits round trips, and mitigates the browser's concurrency limits on outgoing parallel connections.

**Action:** Whenever looping over data to issue a network request, investigate whether the receiving API supports bulk operations (e.g., Supabase passing an array of rows to `upsert`). If supported, refactor to bulk actions to enhance speed and reliability.
