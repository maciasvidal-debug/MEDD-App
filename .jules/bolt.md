## 2025-02-28 - Optimize Array Traversal in Zustand Store
**Learning:** Using `Array.prototype.map()` for single-item updates in large arrays iterates over every element unnecessarily, resulting in sub-optimal O(N) performance for state updates.
**Action:** When updating a single element in a large array, prefer using `Array.prototype.findIndex()` combined with a shallow copy (e.g. `[...array]`) and updating just the matched index. This allows the search to exit early (reducing average execution time) while still remaining an immutable update pattern required by state managers like Zustand.
## 2024-10-18 - Optimize frequency counting loop in text-analysis

**Learning:** When building frequency maps in tight loops inside V8 (like processing tokens), using a raw object created with `Object.create(null)` is roughly 6-10% faster than repeatedly calling `Map.prototype.get` and `Map.prototype.set` due to optimized object property access. Converting the `Record` to a `Map` via `Object.entries()` afterwards maintains the necessary type contract without sacrificing the inner-loop speed gains.

**Action:** Prefer `Object.create(null)` for temporary counting dictionaries in critical hot paths over `Map`, especially when the number of insertions significantly outweighs the overhead of an eventual conversion to a `Map` (if required by the API boundary).
