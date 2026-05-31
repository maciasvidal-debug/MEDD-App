## 2024-05-18 - Dashboard Iteration Performance
**Learning:** React component with multiple filters iterating over an array can become a bottleneck when scaled up, executing O(M * N) iterations. This codebase is no exception where the Dashboard loops over `surveys` multiple times using `.filter()` and `.reduce()`.
**Action:** Consolidate multiple array loops (e.g. `filter`, `reduce`) into a single pass when computing multiple scalar metrics, utilizing an optimized standard `for` loop over the elements and computing all at once.
