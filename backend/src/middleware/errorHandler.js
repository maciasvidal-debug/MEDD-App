// =====================================================================
// Centralized error handling so individual routes don't repeat try/catch
// blocks and status-code mapping. Routes wrap their async handlers with
// asyncHandler and simply throw; everything funnels here.
// =====================================================================

// PostgreSQL error codes that stem from bad client input rather than a
// server fault, and should surface as HTTP 400:
//   23502 not_null_violation   23503 foreign_key_violation
//   23505 unique_violation     23514 check_violation
//   22P02 invalid_text_representation (e.g. malformed integer/uuid)
const CLIENT_PG_CODES = new Set(['23502', '23503', '23505', '23514', '22P02']);

// Wrap an async route handler so rejected promises reach the error handler
// instead of becoming unhandled rejections.
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

// 404 for any unmatched route.
function notFound(req, res) {
    res.status(404).json({ error: 'Recurso no encontrado' });
}

// Final error handler. Maps known DB constraint violations to 400 and hides
// internal details for genuine 5xx errors. The 4-arg signature is required by
// Express to recognize this as an error-handling middleware.
function errorHandler(err, req, res, next) {
    if (res.headersSent) return next(err);

    if (CLIENT_PG_CODES.has(err.code)) {
        return res.status(400).json({
            error: 'Restricción de integridad violada',
            details: [err.detail || err.message],
        });
    }

    const status = err.status || err.statusCode || 500;
    if (status >= 500) console.error(err);
    res.status(status).json({
        error: status >= 500 ? 'Error interno del servidor' : err.message,
    });
}

module.exports = { asyncHandler, notFound, errorHandler };
