// Authentication middleware behavior across the API.
jest.mock('../src/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const request = require('supertest');
const pool = require('../src/db');
const app = require('../src/index');
const { mintToken } = require('./helpers');

beforeEach(() => jest.clearAllMocks());

describe('authentication', () => {
    test('rejects request with no token (401)', async () => {
        const res = await request(app).get('/api/surveys');
        expect(res.status).toBe(401);
    });

    test('rejects malformed token (401)', async () => {
        const res = await request(app)
            .get('/api/surveys')
            .set('Authorization', 'Bearer not.a.real.jwt');
        expect(res.status).toBe(401);
    });

    test('rejects expired token (401)', async () => {
        const token = await mintToken({ expired: true });
        const res = await request(app)
            .get('/api/surveys')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
    });

    test('rejects token with wrong issuer (401)', async () => {
        const token = await mintToken({ issuer: 'https://evil.example/auth/v1' });
        const res = await request(app)
            .get('/api/surveys')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(401);
    });

    test('accepts a valid token (200)', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        const token = await mintToken({ role: 'encuestador' });
        const res = await request(app)
            .get('/api/surveys')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
    });

    test('unknown route returns 404', async () => {
        const res = await request(app).get('/api/does-not-exist');
        expect(res.status).toBe(404);
    });
});
