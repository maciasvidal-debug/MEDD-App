## 2025-02-18 - Hoisting regexes out of hot loops

**Learning:** Repeatedly creating regex objects from literals in hot loops (even with global flags) has a non-negligible cost. Furthermore, iterating over long string arrays can cause many unnecessary `.toLowerCase()` and `.split(/\s+/)` string allocations if not guarded by early-exit conditions.
**Action:** When acting as a performance optimization agent (Bolt), always check for string allocations inside loops, look for opportunities to short-circuit iteration (`break` or `return`), and hoist reusable `RegExp` objects out of functions entirely (to module scope).
