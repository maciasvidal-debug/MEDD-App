// =====================================================================
// SQL helpers shared across routes.
//
// SQL placeholders ($1, $2, ...) bind VALUES only — identifiers (table /
// column names) can never be parameterized this way. Building them via raw
// string concatenation is a SQL-injection anti-pattern, so every dynamic
// identifier is routed through quoteIdent, which applies PostgreSQL's
// identifier-escaping rules: validate the shape, wrap in double quotes, and
// double any embedded quotes (the same logic pg.escapeIdentifier / pg-format's
// %I use internally).
// =====================================================================

const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteIdent(name) {
    if (typeof name !== 'string' || !SAFE_IDENT.test(name)) {
        throw new Error(`Invalid SQL identifier: ${JSON.stringify(name)}`);
    }
    return `"${name.replace(/"/g, '""')}"`;
}

module.exports = { quoteIdent };
