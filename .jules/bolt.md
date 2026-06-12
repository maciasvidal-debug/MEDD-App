## 2024-06-12 - Optimize chiSquareTest function

**Learning:** Reducing passes over nested arrays by manually unrolling `map` and `reduce` combinations and avoiding creating intermediate array allocations with functional constructs, instead using typed arrays (`Float64Array`) and single-pass iteration (`for` loops), provides substantial and consistent performance improvements across large nested datasets (up to ~3.5x improvement).

**Action:** Whenever performance profiling indicates that functional chaining of array operations (`.map().reduce()`) is hot on large datasets or inside frequent calculations, prefer allocating typed arrays once and manually looping. Also, refactor loops to avoid function call overhead for primitives like `Math.min()`.
