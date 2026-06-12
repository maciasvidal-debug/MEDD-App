const express = require('express');
const router = express.Router();
const pool = require('../db');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { quoteIdent } = require('../utils/sql');

// All analytics endpoints expose aggregate data across every survey, so they
// require authentication and are restricted to the 'investigador' role, in
// line with the role model defined in the SQL migrations (002_roles.sql).
router.use(requireAuth);
router.use(requireRole('investigador'));

// ---------------------------------------------------------------------
// Summary KPIs
// ---------------------------------------------------------------------
router.get('/summary', asyncHandler(async (req, res) => {
    // ⚡ Bolt: Run independent queries concurrently and consolidate survey
    // aggregates into a single query. This avoids PostgreSQL evaluating each
    // scalar subquery sequentially and executing 4 separate full table scans
    // of the 'surveys' table.
    const [surveysAgg, medsAgg, expiredAgg] = await Promise.all([
        pool.query(`
            SELECT
                COUNT(*) AS total_surveys,
                COALESCE(SUM(cant_med), 0) AS total_unused_units,
                COALESCE(SUM(cant_med_vto), 0) AS total_expired_units,
                COALESCE(SUM(peso_med_nc), 0) AS total_weight_g
            FROM surveys
        `),
        pool.query(`SELECT COUNT(*) AS total_medications FROM medications`),
        pool.query(`SELECT COUNT(*) AS expired_products FROM v_product_metrics WHERE is_expired`),
    ]);

    const s = surveysAgg.rows[0];
    res.json({
        total_surveys: Number(s.total_surveys),
        total_medications: Number(medsAgg.rows[0].total_medications),
        total_unused_units: Number(s.total_unused_units),
        total_expired_units: Number(s.total_expired_units),
        total_weight_g: Number(s.total_weight_g),
        expired_products: Number(expiredAgg.rows[0].expired_products),
    });
}));

// ---------------------------------------------------------------------
// GEOSPATIAL HOTSPOTS — by CIUDAD, correlated with ESTRATO, expired
// quantity (CANT_MED_VTO) and measured weight (PESO_MED_NC).
// ---------------------------------------------------------------------
router.get('/geo-hotspots', asyncHandler(async (req, res) => {
    const result = await pool.query(`
        SELECT
            COALESCE(ciudad, 'Sin dato')                AS ciudad,
            COUNT(*)                                    AS surveys,
            -- ESTRATO is an ordinal scale (1-6): its arithmetic mean has no valid
            -- interpretation (the 1->2 step is not equal to 5->6). Report the
            -- median, which for ordinal data lands on an actual stratum level.
            PERCENTILE_DISC(0.5) WITHIN GROUP (ORDER BY estrato) AS median_estrato,
            COALESCE(SUM(cant_med), 0)                  AS unused_units,
            COALESCE(SUM(cant_med_vto), 0)              AS expired_units,
            ROUND(COALESCE(SUM(peso_med_nc), 0)::numeric, 2) AS weight_g
        FROM surveys
        GROUP BY COALESCE(ciudad, 'Sin dato')
        ORDER BY expired_units DESC, weight_g DESC
    `);
    res.json(result.rows.map(normalizeNums));
}));

// ---------------------------------------------------------------------
// RISK STRATIFICATION — geographic zone (CIUDAD) x retention-time
// (T_VTO) clusters, to isolate critical waste accumulation centers.
//   Buckets: vigente (no vencido) | 0-180 | 181-365 | >365 días vencido
// ---------------------------------------------------------------------
router.get('/risk', asyncHandler(async (req, res) => {
    const result = await pool.query(`
        SELECT
            COALESCE(ciudad, 'Sin dato') AS ciudad,
            COUNT(*) FILTER (WHERE t_vto IS NULL OR t_vto < 0)            AS vigente,
            COUNT(*) FILTER (WHERE t_vto >= 0   AND t_vto <= 180)         AS d0_180,
            COUNT(*) FILTER (WHERE t_vto >  180 AND t_vto <= 365)         AS d181_365,
            COUNT(*) FILTER (WHERE t_vto >  365)                          AS d365_plus,
            ROUND(AVG(t_vto) FILTER (WHERE t_vto > 0)::numeric, 1)        AS avg_t_vto
        FROM v_product_metrics
        GROUP BY COALESCE(ciudad, 'Sin dato')
        ORDER BY d365_plus DESC, d181_365 DESC
    `);
    res.json(result.rows.map(normalizeNums));
}));

// ---------------------------------------------------------------------
// SOCIO-DEMOGRAPHIC DISTRIBUTION — unused-medicine volume segmented by a
// chosen dimension: ESTRATO | AS_SALUD | CIUDAD (?by=estrato default).
// ---------------------------------------------------------------------
router.get('/socio', asyncHandler(async (req, res) => {
    // Allowlist the grouping dimension: ?by is constrained to known columns and
    // any unknown/malicious value falls back to 'estrato'. quoteIdent is applied
    // as defense-in-depth so a raw identifier can never reach the SQL string.
    const dimMap = {
        estrato: 'estrato', as_salud: 'as_salud', ciudad: 'ciudad',
        nv_estu: 'nv_estu', nv_posg: 'nv_posg',
    };
    const dim = dimMap[req.query.by] || 'estrato';
    const col = quoteIdent(dim, Object.values(dimMap));
    const result = await pool.query(`
        SELECT
            COALESCE(${col}::text, 'Sin dato')           AS segment,
            COUNT(*)                                     AS surveys,
            COALESCE(SUM(cant_med), 0)                   AS unused_units,
            COALESCE(SUM(cant_med_vto), 0)               AS expired_units,
            ROUND(COALESCE(SUM(peso_med_nc), 0)::numeric, 2) AS weight_g,
            ROUND(COALESCE(AVG(cant_med), 0)::numeric, 2)    AS avg_unused_per_survey
        FROM surveys
        GROUP BY COALESCE(${col}::text, 'Sin dato')
        ORDER BY segment ASC
    `);
    res.json({ dimension: dim, data: result.rows.map(normalizeNums) });
}));

// Legacy endpoint kept for backwards compatibility.
router.get('/by-city', asyncHandler(async (req, res) => {
    const result = await pool.query(
        `SELECT COALESCE(ciudad, 'Sin dato') AS city, COUNT(*) AS count
         FROM surveys GROUP BY COALESCE(ciudad, 'Sin dato') ORDER BY count DESC`
    );
    res.json(result.rows.map((r) => ({ city: r.city, count: Number(r.count) })));
}));

// Convert numeric/bigint string columns from pg into JS numbers.
function normalizeNums(row) {
    const out = {};
    for (const [k, val] of Object.entries(row)) {
        if (val !== null && val !== '' && !isNaN(val) && typeof val !== 'boolean' && k !== 'ciudad' && k !== 'segment') {
            out[k] = Number(val);
        } else {
            out[k] = val;
        }
    }
    return out;
}

module.exports = router;
