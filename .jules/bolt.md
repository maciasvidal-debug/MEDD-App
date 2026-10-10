## 2024-10-10 - Regex compilation in hot loops

**Learning:** V8 inline regex literals inside loops can sometimes incur compilation and garbage collection overheads despite being statically analyzable.
**Action:** Always extract regular expressions to module-level constants for use in hot loops such as string normalizations, `replace`, and array processing.
