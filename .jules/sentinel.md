## 2026-06-12 - Fix CORS fallback to false exposing preflight requests

**Vulnerability:** The CORS configuration in Express used `origin: false` as a fallback when no allowed origins were provided. This caused the `cors` middleware to completely ignore OPTIONS requests, causing them to fall through to the application routing, which could expose route existence or trigger wildcards unintentionally.

**Learning:** Express's `cors` middleware treats `origin: false` differently from `origin: []`. Using an empty array (`[]`) guarantees that the middleware actively intercepts the request and responds with a 204 No Content, stripping out `Access-Control-Allow-Origin` headers securely, while `origin: false` simply disables the logic.

**Prevention:** When intending to "fail closed" or enforce strict blocking of cross-origin requests using the Express `cors` middleware, supply an empty array `[]` rather than `false` for the `origin` property.
