// Role-based authorization on the aggregate analytics endpoints.
jest.mock('../src/db', () => ({ query: jest.fn(), connect: jest.fn() }));

const request = require('supertest');
const pool = require('../src/db');
const app = require('../src/index');
const { mintToken } = require('./helpers');

beforeEach(() => jest.clearAllMocks());

describe('analytics authorization', () => {
    test('encuestador is forbidden (403)', async () => {
        const token = await mintToken({ role: 'encuestador' });
        const res = await request(app)
            .get('/api/analytics/summary')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('missing role is forbidden — fail closed (403)', async () => {
        // No user_role claim; with the DB returning no role, access is denied.
        pool.query.mockResolvedValueOnce({ rows: [] });
        const token = await mintToken({ role: null });
        const res = await request(app)
            .get('/api/analytics/summary')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(403);
    });

    test('investigador gets the summary with numbers coerced (200)', async () => {
        // With Promise.all, pool.query is called 3 times concurrently
        pool.query
            .mockResolvedValueOnce({
                rows: [{
                    total_surveys: '2',
                    total_unused_units: '10',
                    total_expired_units: '4',
                    total_weight_g: '5.50',
                }],
            })
            .mockResolvedValueOnce({
                rows: [{ total_medications: '3' }],
            })
            .mockResolvedValueOnce({
                rows: [{ expired_products: '1' }],
            });

        const token = await mintToken({ role: 'investigador' });
        const res = await request(app)
            .get('/api/analytics/summary')
            .set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(200);
        expect(res.body.total_surveys).toBe(2);
        expect(res.body.total_weight_g).toBe(5.5);
    });
});

describe('analytics /socio dimension is allowlisted (SQL injection guard)', () => {
    test('a valid dimension is used and quoted', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        const token = await mintToken({ role: 'investigador' });
        const res = await request(app)
            .get('/api/analytics/socio?by=ciudad')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.dimension).toBe('ciudad');
        const [sql] = pool.query.mock.calls[0];
        expect(sql).toContain('"ciudad"');
    });

    test('a malicious ?by falls back to the safe default and never reaches the SQL', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        const token = await mintToken({ role: 'investigador' });
        const evil = "ciudad)::text,'x') AS s, (SELECT pg_sleep(5))--";
        const res = await request(app)
            .get(`/api/analytics/socio?by=${encodeURIComponent(evil)}`)
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.dimension).toBe('estrato');
        const [sql] = pool.query.mock.calls[0];
        expect(sql).not.toContain('pg_sleep');
        expect(sql).toContain('"estrato"');
    });
});

describe('analytics numeric normalization', () => {
    test('geo-hotspots coerces numeric columns, keeps text, preserves NULL', async () => {
        pool.query.mockResolvedValueOnce({
            rows: [{
                ciudad: 'Bogotá',
                surveys: '12',
                median_estrato: null,       // PERCENTILE_DISC has no COALESCE → can be NULL
                unused_units: '340',
                expired_units: '55',
                weight_g: '1234.50',
            }],
        });
        const token = await mintToken({ role: 'investigador' });
        const res = await request(app)
            .get('/api/analytics/geo-hotspots')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual([{
            ciudad: 'Bogotá',
            surveys: 12,
            median_estrato: null,
            unused_units: 340,
            expired_units: 55,
            weight_g: 1234.5,
        }]);
    });
});
