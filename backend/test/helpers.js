// Helpers to mint real Supabase-style JWTs for tests. Tokens are signed
// HS256 with the test secret, matching the issuer/audience the auth
// middleware enforces, so the genuine verification path runs offline.
const { SignJWT } = require('jose');

const secret = () => new TextEncoder().encode(process.env.SUPABASE_JWT_SECRET);

async function mintToken(opts = {}) {
    const {
        sub = 'user-1',
        role = 'encuestador',
        email = 'user@test.co',
        issuer = `${process.env.SUPABASE_URL}/auth/v1`,
        audience = 'authenticated',
        expired = false,
    } = opts;

    const claims = { email };
    // Surface the app role as a custom claim so the middleware resolves it
    // without a DB lookup (mirrors a Supabase Access Token Hook).
    if (role) claims.user_role = role;

    const builder = new SignJWT(claims)
        .setProtectedHeader({ alg: 'HS256' })
        .setSubject(sub)
        .setIssuer(issuer)
        .setAudience(audience)
        .setIssuedAt()
        .setExpirationTime(expired ? Math.floor(Date.now() / 1000) - 3600 : '1h');

    return builder.sign(secret());
}

module.exports = { mintToken };
