// Environment for the test run. Loaded via Jest "setupFiles" BEFORE any
// module (auth middleware, app) is required, so JWT verification picks up
// these values at import time. HS256 is used in tests (symmetric secret),
// which exercises the real verification path without any network/JWKS call.
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_JWT_SECRET = 'test-secret-please-change-0123456789abcdef';
process.env.CORS_ORIGIN = 'http://localhost:5173';
process.env.PGSSL = 'false';
