## 2024-05-18 - Optimize redundant filters in hot loops
**Learning:** Chaining `.filter().length` in a loop mapping over arrays creates unnecessary intermediate arrays just to get their size, leading to high garbage collection pressure and CPU usage.
**Action:** Replace `.filter().length` with standard `for` loops and counter variables in hot code paths to avoid memory allocations and improve speed.
