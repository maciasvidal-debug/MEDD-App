## 2026-08-08 - Array allocation optimization

**Learning:** Chained array methods like `.map().filter()` create intermediate arrays which causes redundant iterations and garbage collection pressure.
**Action:** When extracting data for analysis (e.g. valid weights), use a single manual `for...of` loop or `.reduce()` to iterate the array exactly once and minimize allocations.
