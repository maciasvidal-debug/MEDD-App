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

const app = express();

// Trust the first proxy hop so rate limiting sees the real client IP when
// deployed behind a load balancer / reverse proxy.
app.set('trust proxy', 1);
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
