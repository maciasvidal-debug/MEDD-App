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
