## 2025-02-28 - Optimize Array Traversal in Zustand Store
**Learning:** Using `Array.prototype.map()` for single-item updates in large arrays iterates over every element unnecessarily, resulting in sub-optimal O(N) performance for state updates.
**Action:** When updating a single element in a large array, prefer using `Array.prototype.findIndex()` combined with a shallow copy (e.g. `[...array]`) and updating just the matched index. This allows the search to exit early (reducing average execution time) while still remaining an immutable update pattern required by state managers like Zustand.
