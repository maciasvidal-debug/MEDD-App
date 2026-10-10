## 2024-05-18 - Optimize redundant filters in hot loops
**Learning:** Chaining `.filter().length` in a loop mapping over arrays creates unnecessary intermediate arrays just to get their size, leading to high garbage collection pressure and CPU usage.
**Action:** Replace `.filter().length` with standard `for` loops and counter variables in hot code paths to avoid memory allocations and improve speed.
## 2024-05-15 - RegExp instantiation in loop

**Learning:** Initializing regular expressions dynamically inside map loops (`.map(s => new RegExp(...))`) causes unnecessary CPU and memory allocation overhead since the same regex pattern is compiled on every iteration.
**Action:** Extract the `new RegExp(...)` compilation outside the `.map()` block whenever the regex pattern relies purely on variables invariant across the iteration. Furthermore, static regex parts like escape character matchers should be hoisted to module-level constants.
