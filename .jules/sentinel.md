## 2025-05-30 - Information Exposure in Database Error Messages
**Vulnerability:** The error handler for the survey creation route (`POST /` in `backend/src/routes/surveys.js`) was directly exposing database error details (`err.detail` and `err.message`) to the client when a database constraint violation occurred (codes 23514 or 23503).
**Learning:** Returning low-level database error strings directly can expose schema information (like column names and constraint definitions) or internal states to potential attackers, facilitating further attacks or intelligence gathering about the architecture.
**Prevention:** Always map generic error messages on the server side when dealing with database constraint violations, instead of passing the raw SQL error details down to the client.
