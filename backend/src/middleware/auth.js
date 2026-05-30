// =====================================================================
// Authentication & authorization middleware for the Express API.
//
// The frontend authenticates against Supabase Auth and sends the user's
// access token as `Authorization: Bearer <jwt>`. Unlike the Supabase
// PostgREST endpoints, this Express service talks to Postgres through a
// privileged pool and therefore BYPASSES the RLS policies defined in the
// SQL migrations. That means RLS protects nothing here — the API must
// authenticate and authorize every request itself, which is what this
// middleware does.
//
// Verification supports both Supabase signing models:
//   - Asymmetric keys (RS256/ES256) verified against the project JWKS
//     endpoint. This is the current Supabase default; no shared secret is
//     stored in the backend and keys rotate transparently.
//   - Legacy symmetric secret (HS256) verified with SUPABASE_JWT_SECRET,
//     for projects still using the classic JWT secret.
// The token's `alg` header selects the path automatically.
// =====================================================================

const { jwtVerify, createRemoteJWKSet, decodeProtectedHeader } = require('jose');
const pool = require('../db');

const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const JWT_SECRET = process.env.SUPABASE_JWT_SECRET || '';

// Supabase issues tokens with iss `<url>/auth/v1` and aud `authenticated`.
const ISSUER = SUPABASE_URL ? `${SUPABASE_URL}/auth/v1` : undefined;
const AUDIENCE = 'authenticated';

// Remote JWKS set (cached + auto-refreshed by jose) for asymmetric tokens.
const jwks = SUPABASE_URL
    ? createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`))
    : null;
// Pre-encoded symmetric key for HS256 tokens.
const hsKey = JWT_SECRET ? new TextEncoder().encode(JWT_SECRET) : null;

async function verifyToken(token) {
    const { alg } = decodeProtectedHeader(token);
    const opts = { issuer: ISSUER, audience: AUDIENCE };
    if (typeof alg === 'string' && alg.startsWith('HS')) {
        if (!hsKey) {
            throw new Error('HS256 token received but SUPABASE_JWT_SECRET is not configured');
        }
        return jwtVerify(token, hsKey, opts);
    }
    if (!jwks) {
        throw new Error('Asymmetric token received but SUPABASE_URL is not configured');
    }
    return jwtVerify(token, jwks, opts);
}

// Resolve the application role (encuestador | investigador). Prefer a custom
// claim injected by a Supabase Access Token Hook; otherwise fall back to the
// user_roles table — the same source as the SQL get_my_role() helper.
async function resolveAppRole(payload) {
    const claimRole = payload.user_role || payload.app_metadata?.app_role;
    if (claimRole) return claimRole;
    if (!payload.sub) return null;
    const r = await pool.query(
        'SELECT role FROM public.user_roles WHERE user_id = $1',
        [payload.sub]
    );
    return r.rows[0]?.role || null;
}

// Require a valid Supabase JWT. Attaches req.user = { id, email, role, claims }.
async function requireAuth(req, res, next) {
    try {
        const header = req.headers.authorization || '';
        const [scheme, token] = header.split(' ');
        if (scheme !== 'Bearer' || !token) {
            return res.status(401).json({ error: 'No autenticado', details: ['Falta el token Bearer'] });
        }
        const { payload } = await verifyToken(token);
        req.user = {
            id: payload.sub,
            email: payload.email,
            role: await resolveAppRole(payload),
            claims: payload,
        };
        next();
    } catch (err) {
        // Do not leak verification internals to the client.
        console.error('Auth verification failed:', err.message);
        return res.status(401).json({ error: 'Token inválido o expirado' });
    }
}

// Require that the authenticated user holds one of the allowed app roles.
// Must run after requireAuth.
function requireRole(...allowed) {
    return (req, res, next) => {
        const role = req.user?.role;
        if (!role || !allowed.includes(role)) {
            return res.status(403).json({
                error: 'Acceso denegado',
                details: [`Requiere rol: ${allowed.join(', ')}`],
            });
        }
        next();
    };
}

module.exports = { requireAuth, requireRole };
