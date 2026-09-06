## 2025-02-18 - Hoisting regexes out of hot loops

**Learning:** Repeatedly creating regex objects from literals in hot loops (even with global flags) has a non-negligible cost. Furthermore, iterating over long string arrays can cause many unnecessary `.toLowerCase()` and `.split(/\s+/)` string allocations if not guarded by early-exit conditions.
**Action:** When acting as a performance optimization agent (Bolt), always check for string allocations inside loops, look for opportunities to short-circuit iteration (`break` or `return`), and hoist reusable `RegExp` objects out of functions entirely (to module scope).
## 2026-09-06 - Testing gap on error paths

**Learning:** When code catches exceptions, a single test that asserts the same fallback value for both "caught an exception" and "got an error response from an API" conflates two distinct scenarios.
**Action:** Write granular test cases that independently verify different failure conditions (e.g., throwing vs. returning an error), to ensure that refactoring doesn't break one of those specific paths silently.
