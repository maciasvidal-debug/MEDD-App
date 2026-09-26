## 2025-02-18 - Hoisting regexes out of hot loops

**Learning:** Repeatedly creating regex objects from literals in hot loops (even with global flags) has a non-negligible cost. Furthermore, iterating over long string arrays can cause many unnecessary `.toLowerCase()` and `.split(/\s+/)` string allocations if not guarded by early-exit conditions.
**Action:** When acting as a performance optimization agent (Bolt), always check for string allocations inside loops, look for opportunities to short-circuit iteration (`break` or `return`), and hoist reusable `RegExp` objects out of functions entirely (to module scope).
## 2026-09-06 - Testing gap on error paths

**Learning:** When code catches exceptions, a single test that asserts the same fallback value for both "caught an exception" and "got an error response from an API" conflates two distinct scenarios.
**Action:** Write granular test cases that independently verify different failure conditions (e.g., throwing vs. returning an error), to ensure that refactoring doesn't break one of those specific paths silently.

## 2024-05-18 - Optimized mapping arrays by pre-computing multipliers
**Learning:** Checking `totalOcc > 0` and dividing values by it inside `.map()` arrays leads to redundant branches and repetitive floating-point division in hot loops.
**Action:** When computing percentages for an array iteratively, pre-compute the percentage multiplier using a ternary operator (e.g., `const factor = total > 0 ? 1 / total : 0`) before the `.map()` loop, and then perform a simple multiplication (`value * factor`) instead of repeating the branch condition and division. This eliminates redundant checks inside iteration and speeds up execution.
