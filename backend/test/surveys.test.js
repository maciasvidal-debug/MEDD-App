// Ownership authorization, :id validation and the bulk-insert POST path.
jest.mock('../src/db', () => ({ query: jest.fn(), connect: jest.fn() }));
// Mock only validateSurvey so these tests focus on the route's DB/ownership
// behavior; the rest of the module (productMetrics, ENUMS) stays real.
jest.mock('../src/schema', () => {
    const actual = jest.requireActual('../src/schema');
    return { ...actual, validateSurvey: jest.fn() };
});

const request = require('supertest');
const pool = require('../src/db');
const schema = require('../src/schema');
const app = require('../src/index');
const { mintToken } = require('./helpers');

beforeEach(() => jest.clearAllMocks());

describe('surveys ownership (list)', () => {
    test('encuestador list is scoped to its own user_id', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        const token = await mintToken({ sub: 'user-9', role: 'encuestador' });
        await request(app).get('/api/surveys').set('Authorization', `Bearer ${token}`);

        const [sql, params] = pool.query.mock.calls[0];
        expect(sql).toMatch(/WHERE s\.user_id = \$1/);
        expect(params).toEqual(['user-9']);
    });

    test('investigador list is not scoped', async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        const token = await mintToken({ role: 'investigador' });
        await request(app).get('/api/surveys').set('Authorization', `Bearer ${token}`);

        const [sql, params] = pool.query.mock.calls[0];
        // No owner filter is applied for investigador — no WHERE clause on user_id.
        expect(sql).not.toMatch(/WHERE s\.user_id/);
        expect(params).toEqual([]);
    });
});

describe('surveys ownership (detail)', () => {
    test('non-numeric :id is rejected before any query (400)', async () => {
        const token = await mintToken();
        const res = await request(app).get('/api/surveys/abc').set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
        expect(pool.query).not.toHaveBeenCalled();
    });

    test("another user's survey returns 404 (no existence leak)", async () => {
        pool.query.mockResolvedValueOnce({ rows: [] });
        const token = await mintToken({ sub: 'user-2', role: 'encuestador' });
        const res = await request(app).get('/api/surveys/123').set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(404);
        const [sql, params] = pool.query.mock.calls[0];
        expect(sql).toMatch(/AND user_id = \$2/);
        expect(params).toEqual(['123', 'user-2']);
    });
});

describe('surveys creation', () => {
    test('invalid body returns 400', async () => {
        schema.validateSurvey.mockReturnValue({ value: null, errors: ['campo requerido'] });
        const token = await mintToken();
        const res = await request(app).post('/api/surveys').send({}).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
        expect(pool.connect).not.toHaveBeenCalled();
    });

    test('null body returns 400', async () => {
        // Here we clear the mock so the real implementation throws its validation
        // error about body being an invalid JSON object, verifying 500 crashes are gone
        schema.validateSurvey.mockRestore();
        const token = await mintToken();
        const res = await request(app).post('/api/surveys').send(null).set('Authorization', `Bearer ${token}`);
        expect(res.status).toBe(400);
        expect(pool.connect).not.toHaveBeenCalled();
        // re-mock for following tests
        jest.spyOn(schema, 'validateSurvey');
    });

    test('stamps user_id from the JWT and bulk-inserts medications (201)', async () => {
        schema.validateSurvey.mockReturnValue({
            value: {
                f_eta: '2024-06-01', f_disp: null,
                medications: [
                    { nm_med: 'A', dci: 'a', conc_med: 1, und_conc: 'mg', f_vto: '2025-01-01' },
                    { nm_med: 'B', dci: 'b', conc_med: 2, und_conc: 'mg', f_vto: '2025-02-01' },
                ],
            },
            errors: [],
        });

        const captured = {};
        const client = {
            query: jest.fn(async (sql, params) => {
                if (/INSERT INTO surveys/.test(sql)) {
                    captured.surveyParams = params;
                    return { rows: [{ nui: 1, user_id: params[params.length - 1], f_eta: '2024-06-01', f_disp: null }] };
                }
                if (/INSERT INTO medications/.test(sql)) {
                    captured.medSql = sql;
                    captured.medParams = params;
                    return { rows: [{ id: 1, nui: 1, f_vto: '2025-01-01' }, { id: 2, nui: 1, f_vto: '2025-02-01' }] };
                }
                return { rows: [] }; // BEGIN / COMMIT
            }),
            release: jest.fn(),
        };
        pool.connect.mockResolvedValue(client);

        const token = await mintToken({ sub: 'owner-7', role: 'encuestador' });
        const res = await request(app).post('/api/surveys').send({}).set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(201);
        // Ownership stamped server-side from the token (last survey param).
        expect(captured.surveyParams[captured.surveyParams.length - 1]).toBe('owner-7');
        // Single bulk INSERT: one statement, 2 rows x 6 cols = 12 params.
        const medInserts = client.query.mock.calls.filter((c) => /INSERT INTO medications/.test(c[0]));
        expect(medInserts).toHaveLength(1);
        expect(captured.medParams).toHaveLength(12);
        expect(res.body.medications).toHaveLength(2);
        expect(client.release).toHaveBeenCalled();
    });

    test('rolls back and maps a DB constraint violation to 400', async () => {
        schema.validateSurvey.mockReturnValue({
            value: { f_eta: '2024-06-01', f_disp: null, medications: [] },
            errors: [],
        });
        const client = {
            query: jest.fn(async (sql) => {
                if (/INSERT INTO surveys/.test(sql)) {
                    const err = new Error('check violation');
                    err.code = '23514';
                    throw err;
                }
                return { rows: [] };
            }),
            release: jest.fn(),
        };
        pool.connect.mockResolvedValue(client);

        const token = await mintToken();
        const res = await request(app).post('/api/surveys').send({}).set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(400);
        expect(client.query).toHaveBeenCalledWith('ROLLBACK');
        expect(client.release).toHaveBeenCalled();
    });
});
