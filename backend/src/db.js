// =====================================================================
// PostgreSQL connection pool, shared by every route.
//
// Connection comes from DATABASE_URL (preferred — e.g. the Supabase
// connection string) or the standard PG* environment variables. Managed
// Postgres (Supabase included) requires TLS, so SSL is on by default and
// can be disabled for local development with PGSSL=false.
// =====================================================================

const { Pool } = require('pg');

const ssl = process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false };

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl,
    max: Number(process.env.PG_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
});

// A pooled client can emit errors after acquisition (e.g. dropped connection);
// log instead of letting it crash the process.
pool.on('error', (err) => {
    console.error('Unexpected error on idle PG client:', err.message);
});

module.exports = pool;
