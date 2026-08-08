## 2024-05-18 - Simplifying O(1) manual lookup

**Learning:** Over-engineered "optimizations" using explicit loop boundaries and manual state arrays instead of native array methods (`.find`) increase cognitive load and codebase noise without substantial performance gains in most client-side scenarios.
**Action:** Default to idiomatic array iteration (e.g. `.find()`, `.filter()`, `.map()`) rather than manual pointer increment loops (`for (let i = 0...)`) when operating on small/bounded arrays, favoring readability.
