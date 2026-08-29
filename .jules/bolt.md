## 2024-05-16 - Optimizing array state removal in React

**Learning:** When removing a single element from an array held in React state, replacing `filter` with `splice` on a shallow copy (e.g. `const next = [...prev]; next.splice(idx, 1)`) can significantly improve performance for large arrays by avoiding the allocation of new elements on every iteration and reducing garbage collection pressure.

**Action:** Use `splice` on a shallow copy instead of `filter` when removing single elements from large arrays in state to improve performance.
