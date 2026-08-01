## 2026-06-12 - Fix CORS fallback to false exposing preflight requests

**Vulnerability:** The CORS configuration in Express used `origin: false` as a fallback when no allowed origins were provided. This caused the `cors` middleware to completely ignore OPTIONS requests, causing them to fall through to the application routing, which could expose route existence or trigger wildcards unintentionally.

**Learning:** Express's `cors` middleware treats `origin: false` differently from `origin: []`. Using an empty array (`[]`) guarantees that the middleware actively intercepts the request and responds with a 204 No Content, stripping out `Access-Control-Allow-Origin` headers securely, while `origin: false` simply disables the logic.

**Prevention:** When intending to "fail closed" or enforce strict blocking of cross-origin requests using the Express `cors` middleware, supply an empty array `[]` rather than `false` for the `origin` property.
## 2025-05-30 - Information Exposure in Database Error Messages
**Vulnerability:** The error handler for the survey creation route (`POST /` in `backend/src/routes/surveys.js`) was directly exposing database error details (`err.detail` and `err.message`) to the client when a database constraint violation occurred (codes 23514 or 23503).
**Learning:** Returning low-level database error strings directly can expose schema information (like column names and constraint definitions) or internal states to potential attackers, facilitating further attacks or intelligence gathering about the architecture.
**Prevention:** Always map generic error messages on the server side when dealing with database constraint violations, instead of passing the raw SQL error details down to the client.
## 2024-05-31 - Add input length limits
**Vulnerability:** Missing input length limits on text fields in the backend.
**Learning:** The Express backend parses JSON up to 100kb, but the application's schema validation did not check individual field string lengths. This poses a Denial of Service (DoS) and resource exhaustion risk.
**Prevention:** Always cap strings at their expected maximum length as a layer of defense in depth before passing them to the database.
## 2026-06-02 - Unhandled Null/Undefined Request Body Leading to 500 Errors
**Vulnerability:** The API endpoint `/api/surveys` crashed with a 500 error when receiving a null or missing JSON body due to the validation logic unconditionally accessing properties (`body.nui_etr`).
**Learning:** Relying on upstream JSON parsing to always provide an object without explicit defensive checks leaves the server open to unhandled type errors when `null` or array structures are submitted.
**Prevention:** Validation layers must explicitly assert that the input is a valid object before attempting to extract its fields.
## 2026-06-02 - Secure UUID generation
**Vulnerability:** The `uuid` utility used `Math.random` when `crypto.randomUUID` was unavailable. This is cryptographically insecure and could lead to predictable IDs or collisions.
**Learning:** In frontend applications, always ensure a cryptographically secure random number generator is used for identifiers, particularly when offline sync could cause collisions if IDs are predictable.
**Prevention:** Fallback UUID generators should use `crypto.getRandomValues()` to obtain randomness securely.
## 2025-05-30 - Information Exposure in Database Error Messages
**Vulnerability:** The error handler for the survey creation route (`POST /` in `backend/src/routes/surveys.js`) was directly exposing database error details (`err.detail` and `err.message`) to the client when a database constraint violation occurred (codes 23514 or 23503).
**Learning:** Returning low-level database error strings directly can expose schema information (like column names and constraint definitions) or internal states to potential attackers, facilitating further attacks or intelligence gathering about the architecture.
**Prevention:** Always map generic error messages on the server side when dealing with database constraint violations, instead of passing the raw SQL error details down to the client. Ensure to keep `err.message` in the general error handler to not mask validation errors that are supposed to be shown to users.
## 2026-06-12 - Unvalidated Dynamic SQL Identifier Fix
**Vulnerability:** The `quoteIdent` function in `backend/src/utils/sql.js` verified the structural shape of SQL identifiers using a regex but did not ensure that the provided identifiers belong to an explicitly allowed list of columns. This structural-only validation left the system open to attacks where an attacker could provide structurally valid but unauthorized column names, potentially exposing or modifying unallowed data (SQL identifier injection or data leakage).
**Learning:** When dealing with dynamic SQL identifiers (such as column or table names), it's not enough to ensure the identifiers are syntactically safe (i.e. preventing traditional SQL injection payload like `'; DROP TABLE...`). You must also implement an allowlist (or explicit mappings) to guarantee that the requested identifier is authorized for the given context.
**Prevention:** Always require an explicit allowlist of authorized identifiers alongside syntactic validation when building dynamic SQL queries. The `quoteIdent` function was updated to require a second argument containing an array of permitted identifiers, immediately throwing an error if the passed identifier isn't in this `allowlist`.
## 2026-06-12 - Missing Environment Variable Validation for Supabase
**Vulnerability:** The `src/lib/supabase.ts` file assumed that `import.meta.env.VITE_SUPABASE_URL` and `import.meta.env.VITE_SUPABASE_ANON_KEY` were present and coerced them to strings using `as string`. This could lead to silent failures, unexpected states, or broken configurations at runtime if the environment variables were missing during the build step.
**Learning:** Even though anonymous keys are meant to be public and rely on Row-Level Security (RLS) for data protection, failing to validate their presence during initialization is poor security hygiene. Missing variables coerced to strings bypass type checks and lead to hard-to-debug failures in production.
**Prevention:** Always validate critical environment variables at initialization time. If they are missing, throw a clear and immediate error to prevent the application from starting in an insecure or invalid state.
