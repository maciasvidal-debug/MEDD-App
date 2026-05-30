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
        pool.query.mockResolvedValueOnce({
            rows: [{
                total_surveys: '2',
                total_medications: '3',
                total_unused_units: '10',
                total_expired_units: '4',
                total_weight_g: '5.50',
                expired_products: '1',
            }],
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
