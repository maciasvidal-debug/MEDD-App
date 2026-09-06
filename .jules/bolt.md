## 2025-02-12 - Upgrading array includes to Set has for O(1) lookups in hot loops
**Learning:** Calling `Array.includes()` inside a loop that iterates over large collections creates an O(N*M) time complexity trap, especially when checking against static constants.
**Action:** When validating collection elements against a static list of valid options in a hot loop, pre-compute a module-level `Set` of the options and use `Set.has()` to upgrade the validation check to O(1) time complexity. Additionally, use `Object.create(null)` instead of `Map` for faster frequency tracking when dealing with string keys in V8.
## 2024-05-18 - Dictionary Caching in Hot Regex Loops
**Learning:** In V8/JavaScript environments, repeatedly running complex string replacement regexes on the exact same dictionary vocabulary words (e.g. during NLP normalization and stop-word filtering) causes massive CPU overhead. Caching the output string mapped to the input string provides huge gains.
**Action:** Always consider memoizing side-effect free normalisation / transformation functions if they are called inside hot loops over a repeated finite vocabulary (like word tokenizers). Use `Object.create(null)` for unbounded cache dictionaries rather than ES6 Maps when we just need simple string lookups, as null-prototype objects do not inherit properties that might otherwise conflict with user text patterns and they have negligible overhead.
## 2026-09-05 - Optimize Map usage for dictionary counts

**Learning:** When frequency counting loops inside analytical metrics logic track categorical string values, mapping tools typically utilize Map instances. Using `Object.create(null)` instead acts as a raw dictionary, skipping Map's `.get()` and `.set()` prototype lookups and yielding ~1.5x throughput optimization in Node V8.

**Action:** Replace `Map<string, number>` with `Record<string, number> = Object.create(null)` across metric counters that rely heavily on string keys across frequent iterations. Iteration can still safely proceed using `Object.entries()`.
