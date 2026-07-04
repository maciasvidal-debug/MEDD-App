// =====================================================================
// MEDD-App API server entrypoint. Assembles the Express app with security
// hardening (helmet, restricted CORS, body-size limit, rate limiting),
// mounts the feature routers, and wires the centralized error handler.
// =====================================================================

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const surveys = require('./routes/surveys');
const analytics = require('./routes/analytics');
const { notFound, errorHandler } = require('./middleware/errorHandler');

// Interpret the TRUST_PROXY env var into a value Express accepts for its
// 'trust proxy' setting. Returns undefined when unset so the caller can leave
// the Express default (disabled) in place.
function parseTrustProxy(value) {
    if (value === undefined || value.trim() === '') return undefined;
    const v = value.trim();
    if (v.toLowerCase() === 'true') return true;
    if (v.toLowerCase() === 'false') return false;
    if (/^\d+$/.test(v)) return Number(v); // number of proxy hops to trust
    return v; // IP / subnet / preset list passed through to Express
}

const app = express();

// Configure proxy trust for rate limiting. Express derives the client IP from
// the X-Forwarded-For header ONLY when a proxy is trusted, so trust must stay
// OFF by default: a direct-to-internet deployment that trusts proxies lets any
// client spoof X-Forwarded-For and bypass the rate limits. Opt in via
// TRUST_PROXY only when actually behind a load balancer / reverse proxy:
//   - a hop count, e.g. "1"
//   - "true" / "false"
//   - a comma-separated list of trusted IPs / subnets / preset names,
//     e.g. "loopback, 10.0.0.0/8"
// When TRUST_PROXY is unset, Express keeps its secure default (disabled).
const trustProxy = parseTrustProxy(process.env.TRUST_PROXY);
if (trustProxy !== undefined) {
    app.set('trust proxy', trustProxy);
}
app.disable('x-powered-by');

// Secure HTTP headers.
app.use(helmet());

// CORS restricted to the configured frontend origin(s). Defaults to blocking
// cross-origin requests when CORS_ORIGIN is unset (fail-closed).
const allowedOrigins = (process.env.CORS_ORIGIN || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
app.use(cors({
    origin: allowedOrigins.length ? allowedOrigins : [],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
}));

// Bound the JSON body size to blunt oversized-payload abuse.
app.use(express.json({ limit: process.env.JSON_LIMIT || '100kb' }));

// Baseline rate limit for every request.
app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX) || 300,
    standardHeaders: true,
    legacyHeaders: false,
}));

// Tighter limit for state-changing writes.
const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.WRITE_RATE_LIMIT_MAX) || 30,
    standardHeaders: true,
    legacyHeaders: false,
});
const limitWrites = (req, res, next) => (req.method === 'POST' ? writeLimiter(req, res, next) : next());

// Liveness probe (unauthenticated, no DB hit).
app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/api/surveys', limitWrites, surveys);
app.use('/api/analytics', analytics);

app.use(notFound);
app.use(errorHandler);

const port = Number(process.env.PORT) || 3000;
if (require.main === module) {
    app.listen(port, () => console.log(`MEDD-App API listening on port ${port}`));
}

module.exports = app;
