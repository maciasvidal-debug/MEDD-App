const express = require('express');
const router = express.Router();
const pool = require('../db');
const { ENUMS, CIUDADES, validateSurvey, productMetrics } = require('../schema');

// Full ordered column list shared by INSERT and SELECT mapping.
const SURVEY_COLS = [
    'f_eta', 'nui_etr', 'f_nac', 'edad', 'ciudad', 'dir', 'estrato', 'etnia',
    'as_salud', 'est_lab', 'ingreso', 'nv_estu', 'per_salud', 'est_salud',
    'prb_salud', 'con_med', 'med_prc', 'f_prc', 'f_disp', 'ind_med', 'med_sob',
    'disp_med_vc', 'cto_disp_vc', 'vto_med_nc', 'cant_med', 'cant_med_vto',
    'peso_med_nc', 'obs',
];

// GET codebook metadata (enums + city list) so the UI never hard-codes vocab.
router.get('/meta', (req, res) => {
    res.json({ enums: ENUMS, ciudades: CIUDADES });
});

// GET all surveys (summary list)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT s.*,
                    (SELECT COUNT(*) FROM medications m WHERE m.nui = s.nui) AS med_count
             FROM surveys s ORDER BY s.nui DESC`
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Error fetching surveys' });
    }
});

// GET single survey with medications + computed time metrics
router.get('/:id', async (req, res) => {
    try {
        const surveyResult = await pool.query('SELECT * FROM surveys WHERE nui = $1', [req.params.id]);
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

        const placeholders = SURVEY_COLS.map((_, i) => `$${i + 1}`).join(', ');
        const params = SURVEY_COLS.map((c) => value[c]);
        const surveyResult = await client.query(
            `INSERT INTO surveys (${SURVEY_COLS.join(', ')}) VALUES (${placeholders}) RETURNING *`,
            params
        );
        const survey = surveyResult.rows[0];

        // Bulk insert all medications in a single query to avoid N+1.
        let insertedMeds = [];
        if (value.medications.length) {
            const COLS_PER_MED = 6;
            const medParams = [];
            const valueGroups = value.medications.map((med, i) => {
                const base = i * COLS_PER_MED;
                medParams.push(survey.nui, med.nm_med, med.dci, med.conc_med, med.und_conc, med.f_vto);
                return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
            });
            const medsResult = await client.query(
                `INSERT INTO medications (nui, nm_med, dci, conc_med, und_conc, f_vto)
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
