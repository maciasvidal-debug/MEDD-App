## 2024-10-10 - Regex compilation in hot loops

**Learning:** V8 inline regex literals inside loops can sometimes incur compilation and garbage collection overheads despite being statically analyzable.
**Action:** Always extract regular expressions to module-level constants for use in hot loops such as string normalizations, `replace`, and array processing.
## 2024-05-18 - Optimize redundant filters in hot loops
**Learning:** Chaining `.filter().length` in a loop mapping over arrays creates unnecessary intermediate arrays just to get their size, leading to high garbage collection pressure and CPU usage.
**Action:** Replace `.filter().length` with standard `for` loops and counter variables in hot code paths to avoid memory allocations and improve speed.

## 2024-10-10 - Optimizing Array Traversals in Data Aggregation Loops
**Learning:** When aggregating frequently-accessed array properties inside hot loops (e.g., tallying values across large datasets), repeatedly allocating temporary arrays using higher-order functions like `.filter(Boolean)` adds significant CPU and garbage collection overhead. In functions like `buildClassMotiveCross`, chaining array operations (`s.motNoConsumo.filter(Boolean)`) inside nested loops over 10,000 items creates extreme performance bottlenecks.
**Action:** Extract higher-order array filters from hot paths. Instead, implement standard `for` loops across the original array lengths and conditionally bypass unwanted elements (e.g., `if (!mo) continue`) directly within the traversal logic while applying the primary business logic. This enables single-pass traversal without generating intermediate array allocations, dramatically improving execution speed.
## 2024-05-15 - RegExp instantiation in loop

**Learning:** Initializing regular expressions dynamically inside map loops (`.map(s => new RegExp(...))`) causes unnecessary CPU and memory allocation overhead since the same regex pattern is compiled on every iteration.
**Action:** Extract the `new RegExp(...)` compilation outside the `.map()` block whenever the regex pattern relies purely on variables invariant across the iteration. Furthermore, static regex parts like escape character matchers should be hoisted to module-level constants.
