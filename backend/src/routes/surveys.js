const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ENUMS, CIUDADES, validateSurvey, productMetrics } = require('../schema');
const { requireAuth } = require('../middleware/auth');

// Survey data is sensitive: every endpoint below requires a valid Supabase
// JWT. This is enforced at the router level so protection travels with the
// router regardless of how/where it is mounted in the app.
router.use(requireAuth);

// Full ordered column list shared by INSERT and SELECT mapping.
const SURVEY_COLS = [
    'f_eta', 'nui_etr', 'f_nac', 'edad', 'ciudad', 'dir', 'estrato', 'etnia',
    'as_salud', 'est_lab', 'ingreso', 'nv_estu', 'per_salud', 'est_salud',
    'prb_salud', 'con_med', 'med_prc', 'f_prc', 'f_disp', 'ind_med', 'med_sob',
    'disp_med_vc', 'cto_disp_vc', 'vto_med_nc', 'cant_med', 'cant_med_vto',
    'peso_med_nc', 'obs',
];

// Ordered column list for the medications INSERT.
const MED_COLS = ['nui', 'nm_med', 'dci', 'conc_med', 'und_conc', 'f_vto'];

// SQL placeholders ($1, $2, ...) bind VALUES only — identifiers (table/column
// names) can never be parameterized this way. Building them via raw string
// concatenation is a SQL-injection anti-pattern, so every identifier is routed
// through this helper, which applies PostgreSQL's identifier-escaping rules:
// validate the shape, wrap in double quotes, and double any embedded quotes
// (the same logic pg.escapeIdentifier / pg-format's %I use internally). This
// keeps the pattern safe even if a column list is later extended or sourced
// from outside this module.
const SAFE_IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
function quoteIdent(name) {
    if (typeof name !== 'string' || !SAFE_IDENT.test(name)) {
        throw new Error(`Invalid SQL identifier: ${JSON.stringify(name)}`);
    }
    return `"${name.replace(/"/g, '""')}"`;
}

// GET codebook metadata (enums + city list) so the UI never hard-codes vocab.
router.get('/meta', (req, res) => {
    res.json({ enums: ENUMS, ciudades: CIUDADES });
});

// GET all surveys (summary list). Owner-scoped: an encuestador only sees its
// own surveys; an investigador sees all (mirrors the survey_select RLS policy).
// Fail-closed — any role other than investigador is restricted to its own rows.
router.get('/', async (req, res) => {
    try {
        const all = req.user.role === 'investigador';
        const where = all ? '' : 'WHERE s.user_id = $1';
        const params = all ? [] : [req.user.id];
        const result = await pool.query(
            `SELECT s.*,
                    (SELECT COUNT(*) FROM medications m WHERE m.nui = s.nui) AS med_count
             FROM surveys s ${where} ORDER BY s.nui DESC`,
            params
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching surveys' });
    }
});

// GET single survey with medications + computed time metrics. Owner-scoped:
// non-investigador users can only read their own surveys. A survey that exists
// but belongs to someone else returns 404 (not 403) so the API never reveals
// the existence of other users' records.
router.get('/:id', async (req, res) => {
    try {
        const all = req.user.role === 'investigador';
        const surveyResult = await pool.query(
            all
                ? 'SELECT * FROM surveys WHERE nui = $1'
                : 'SELECT * FROM surveys WHERE nui = $1 AND user_id = $2',
            all ? [req.params.id] : [req.params.id, req.user.id]
        );
        if (surveyResult.rows.length === 0) {
            return res.status(404).json({ error: 'Survey not found' });
        }
        const survey = surveyResult.rows[0];
        const medsResult = await pool.query(
            'SELECT * FROM medications WHERE nui = $1 ORDER BY id', [req.params.id]
        );
        survey.medications = medsResult.rows.map((m) => ({
            ...m,
            metrics: productMetrics(toIso(survey), toIsoMed(m)),
        }));
        res.json(survey);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching survey' });
    }
});

// POST create survey (atomic with its N medications)
router.post('/', async (req, res) => {
    const { value, errors } = validateSurvey(req.body);
    if (errors.length) {
        return res.status(400).json({ error: 'Validación fallida', details: errors });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Ownership is stamped server-side from the verified JWT, never taken
        // from the request body — the client cannot spoof or even see it.
        const insertCols = [...SURVEY_COLS, 'user_id'];
        const params = [...SURVEY_COLS.map((c) => value[c]), req.user.id];
        const surveyCols = insertCols.map(quoteIdent).join(', ');
        const placeholders = insertCols.map((_, i) => `$${i + 1}`).join(', ');
        const surveyResult = await client.query(
            `INSERT INTO surveys (${surveyCols}) VALUES (${placeholders}) RETURNING *`,
            params
        );
        const survey = surveyResult.rows[0];

        // Bulk insert all medications in a single query to avoid N+1.
        let insertedMeds = [];
        if (value.medications.length) {
            const medCols = MED_COLS.map(quoteIdent).join(', ');
            const colCount = MED_COLS.length;
            const medParams = [];
            const valueGroups = value.medications.map((med, i) => {
                const base = i * colCount;
                medParams.push(survey.nui, med.nm_med, med.dci, med.conc_med, med.und_conc, med.f_vto);
                return `(${MED_COLS.map((_, j) => `$${base + j + 1}`).join(', ')})`;
            });
            const medsResult = await client.query(
                `INSERT INTO medications (${medCols})
                 VALUES ${valueGroups.join(', ')} RETURNING *`,
                medParams
            );
            insertedMeds = medsResult.rows;
        }

        await client.query('COMMIT');
        survey.medications = insertedMeds.map((m) => ({
            ...m,
            metrics: productMetrics(toIso(survey), toIsoMed(m)),
        }));
        res.status(201).json(survey);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        // Surface DB CHECK violations as 400 rather than opaque 500.
        if (err.code === '23514' || err.code === '23503') {
            return res.status(400).json({ error: 'Restricción de integridad violada', details: [err.detail || err.message] });
        }
        res.status(500).json({ error: 'Error creating survey' });
    } finally {
        client.release();
    }
});

// PG returns DATE columns as JS Date objects; normalize to YYYY-MM-DD for calc.
function isoDate(d) {
    if (!d) return null;
    if (typeof d === 'string') return d.slice(0, 10);
    return new Date(d).toISOString().slice(0, 10);
}
function toIso(survey) {
    return { f_eta: isoDate(survey.f_eta), f_disp: isoDate(survey.f_disp) };
}
function toIsoMed(med) {
    return { f_vto: isoDate(med.f_vto) };
}

module.exports = router;
