// =====================================================================
// Codebook-driven domain model, enums and server-side validation.
// Single source of truth for field names, controlled vocabularies and
// relational rules. Keeps the API authoritative (QbD / zero-regression)
// regardless of what the client sends.
// =====================================================================

// Controlled vocabularies (CONSTRAINTS / VALUES from the codebook) --------
const ENUMS = {
    estrato: [1, 2, 3, 4, 5, 6],
    etnia: ['Indígena', 'Gitano/ROM', 'Afrodescendiente', 'Ninguna'],
    as_salud: ['Contributivo', 'Subsidiado', 'Especial', 'No afiliado'],
    est_lab: ['Empleado', 'Independiente', 'Hogar', 'Pensionado', 'Estudiante'],
    ingreso: ['< 1 SMMLV', '1-3 SMMLV', '> 4 SMMLV', 'No responde'],
    nv_estu: ['Ninguno', 'Primaria', 'Secundaria', 'Bachiller', 'Técnico', 'Profesional'],
    per_salud: ['Buena', 'Regular', 'Mala'],
    und_conc: ['mcg', 'mg', 'g', 'UI', '%'],
};

// Main Colombian cities (CIUDAD dropdown source) -------------------------
const CIUDADES = [
    'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena', 'Cúcuta',
    'Bucaramanga', 'Pereira', 'Santa Marta', 'Ibagué', 'Manizales', 'Villavicencio',
    'Pasto', 'Neiva', 'Armenia', 'Montería', 'Sincelejo', 'Popayán', 'Valledupar',
    'Tunja', 'Riohacha', 'Florencia', 'Quibdó', 'Yopal', 'Mocoa', 'Leticia', 'Otro',
];

const isInt = (v) => Number.isInteger(v);
const toDate = (s) => (s ? new Date(s + 'T00:00:00') : null);
const isValidDateStr = (s) => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));

// Days difference (whole days), a - b. Mirrors the Excel date subtraction.
function dayDiff(a, b) {
    if (!a || !b) return null;
    const MS = 24 * 60 * 60 * 1000;
    return Math.round((toDate(a) - toDate(b)) / MS);
}

// EDAD = completed years between F_NAC and F_ETA.
function calcEdad(f_eta, f_nac) {
    if (!isValidDateStr(f_eta) || !isValidDateStr(f_nac)) return null;
    const eta = toDate(f_eta), nac = toDate(f_nac);
    let age = eta.getFullYear() - nac.getFullYear();
    const m = eta.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && eta.getDate() < nac.getDate())) age--;
    return age;
}

// Coerce the various truthy/falsy boolean encodings (1/0, "1"/"0", true/false).
function toBool(v) {
    if (v === null || v === undefined || v === '') return null;
    if (v === true || v === 1 || v === '1' || v === 'true') return true;
    if (v === false || v === 0 || v === '0' || v === 'false') return false;
    return null;
}

function toIntOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : NaN;
}

function toNumOrNull(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
}

// ---------------------------------------------------------------------
// Normalize + validate a survey payload. Returns { value, errors }.
// `value` is a clean object with the deterministic field-logic applied
// (child fields blanked when their parent gate is closed).
// ---------------------------------------------------------------------
function validateSurvey(body) {
    const errors = [];
    const today = new Date().toISOString().slice(0, 10);
    const v = {};

    // --- Identity / dates -------------------------------------------------
    v.nui_etr = toIntOrNull(body.nui_etr);
    if (v.nui_etr === null || Number.isNaN(v.nui_etr) || v.nui_etr <= 0)
        errors.push('NUI_ETR (ID del encuestador) debe ser un entero positivo.');

    v.f_eta = isValidDateStr(body.f_eta) ? body.f_eta : null;
    if (!v.f_eta) errors.push('F_ETA (fecha de entrevista) es obligatoria (YYYY-MM-DD).');
    else if (v.f_eta > today) errors.push('F_ETA no puede ser una fecha futura.');

    v.f_nac = isValidDateStr(body.f_nac) ? body.f_nac : null;
    if (!v.f_nac) errors.push('F_NAC (fecha de nacimiento) es obligatoria (YYYY-MM-DD).');
    else if (v.f_eta && v.f_nac >= v.f_eta) errors.push('F_NAC debe ser anterior a F_ETA.');

    v.edad = calcEdad(v.f_eta, v.f_nac); // EDAD is always derived server-side.

    // --- Socio-demographic ------------------------------------------------
    v.ciudad = body.ciudad ? String(body.ciudad).trim() : null;
    v.dir = body.dir ? String(body.dir).trim() : null;

    v.estrato = toIntOrNull(body.estrato);
    if (v.estrato !== null && !ENUMS.estrato.includes(v.estrato))
        errors.push('ESTRATO debe ser un valor entre 1 y 6.');

    v.etnia = enumOrNull('ETNIA', body.etnia, ENUMS.etnia, errors);
    v.as_salud = enumOrNull('AS_SALUD', body.as_salud, ENUMS.as_salud, errors);
    v.est_lab = enumOrNull('EST_LAB', body.est_lab, ENUMS.est_lab, errors);
    v.ingreso = enumOrNull('INGRESO', body.ingreso, ENUMS.ingreso, errors);
    v.nv_estu = enumOrNull('NV_ESTU', body.nv_estu, ENUMS.nv_estu, errors);
    v.per_salud = enumOrNull('PER_SALUD', body.per_salud, ENUMS.per_salud, errors);

    // --- Health gate chain (deterministic sanitization) -------------------
    v.est_salud = toBool(body.est_salud);

    if (v.est_salud === true) {
        v.prb_salud = body.prb_salud ? String(body.prb_salud).trim() : null;
        if (!v.prb_salud) errors.push('PRB_SALUD es obligatorio cuando EST_SALUD = Sí.');
        v.con_med = toBool(body.con_med);
        if (v.con_med === null) errors.push('CON_MED es obligatorio cuando EST_SALUD = Sí.');
    } else {
        // EST_SALUD == 0 -> clear PRB_SALUD, CON_MED, MED_PRC, F_PRC, F_DISP, IND_MED
        v.prb_salud = null;
        v.con_med = null;
    }

    if (v.con_med === true) {
        v.med_prc = toBool(body.med_prc);
        if (v.med_prc === null) errors.push('MED_PRC es obligatorio cuando CON_MED = Sí.');
    } else {
        // CON_MED == 0 -> clear MED_PRC, F_PRC, F_DISP, IND_MED
        v.med_prc = null;
    }

    if (v.med_prc === true) {
        v.f_prc = isValidDateStr(body.f_prc) ? body.f_prc : null;
        v.f_disp = isValidDateStr(body.f_disp) ? body.f_disp : null;
        v.ind_med = toBool(body.ind_med);
        if (v.ind_med === null) errors.push('IND_MED es obligatorio cuando MED_PRC = Sí.');
        if (v.f_prc) {
            if (v.f_nac && v.f_prc < v.f_nac) errors.push('F_PRC no puede ser anterior a F_NAC.');
            if (v.f_eta && v.f_prc > v.f_eta) errors.push('F_PRC no puede ser posterior a F_ETA.');
        }
        if (v.f_disp) {
            if (v.f_prc && v.f_disp < v.f_prc) errors.push('F_DISP no puede ser anterior a F_PRC.');
            if (v.f_eta && v.f_disp > v.f_eta) errors.push('F_DISP no puede ser posterior a F_ETA.');
        }
    } else {
        // MED_PRC == 0 -> clear F_PRC, F_DISP, IND_MED
        v.f_prc = null;
        v.f_disp = null;
        v.ind_med = null;
    }

    // --- Storage / disposal ----------------------------------------------
    v.med_sob = toBool(body.med_sob);

    v.disp_med_vc = toBool(body.disp_med_vc);
    if (v.disp_med_vc === true) {
        v.cto_disp_vc = body.cto_disp_vc ? String(body.cto_disp_vc).trim() : null;
        if (!v.cto_disp_vc) errors.push('CTO_DISP_VC es obligatorio cuando DISP_MED_VC = Sí.');
    } else {
        // DISP_MED_VC == 0 -> clear CTO_DISP_VC
        v.cto_disp_vc = null;
    }

    v.vto_med_nc = toBool(body.vto_med_nc);

    v.cant_med = toIntOrNull(body.cant_med);
    if (v.cant_med !== null && (Number.isNaN(v.cant_med) || v.cant_med < 0))
        errors.push('CANT_MED debe ser un entero >= 0.');

    v.cant_med_vto = toIntOrNull(body.cant_med_vto);
    if (v.cant_med_vto !== null && (Number.isNaN(v.cant_med_vto) || v.cant_med_vto < 0))
        errors.push('CANT_MED_VTO debe ser un entero >= 0.');
    if (
        v.cant_med_vto !== null && v.cant_med !== null &&
        !Number.isNaN(v.cant_med_vto) && !Number.isNaN(v.cant_med) &&
        v.cant_med_vto > v.cant_med
    )
        errors.push('CANT_MED_VTO no puede exceder CANT_MED.');

    v.peso_med_nc = toNumOrNull(body.peso_med_nc);
    if (v.peso_med_nc !== null && (Number.isNaN(v.peso_med_nc) || v.peso_med_nc < 0))
        errors.push('PESO_MED_NC debe ser un número >= 0.');

    v.obs = body.obs ? String(body.obs).trim() : null;

    // --- Medications (1:N sub-form) --------------------------------------
    const meds = Array.isArray(body.medications) ? body.medications : [];
    v.medications = meds.map((m, i) => {
        const med = {
            nm_med: m.nm_med ? String(m.nm_med).trim() : null,
            dci: m.dci ? String(m.dci).trim() : null,
            conc_med: toNumOrNull(m.conc_med),
            und_conc: m.und_conc || null,
            f_vto: isValidDateStr(m.f_vto) ? m.f_vto : null,
        };
        if (!med.nm_med && !med.dci)
            errors.push(`Medicamento #${i + 1}: requiere al menos Nombre comercial (NM_MED) o DCI.`);
        if (med.conc_med !== null && (Number.isNaN(med.conc_med) || med.conc_med < 0))
            errors.push(`Medicamento #${i + 1}: CONC_MED debe ser un número >= 0.`);
        if (med.und_conc && !ENUMS.und_conc.includes(med.und_conc))
            errors.push(`Medicamento #${i + 1}: UND_CONC inválida.`);
        if (m.f_vto && !med.f_vto)
            errors.push(`Medicamento #${i + 1}: F_VTO debe tener formato YYYY-MM-DD.`);
        return med;
    });

    return { value: v, errors };
}

function enumOrNull(label, raw, allowed, errors) {
    if (raw === null || raw === undefined || raw === '') return null;
    const s = String(raw).trim();
    if (!allowed.includes(s)) {
        errors.push(`${label} contiene un valor no permitido.`);
        return null;
    }
    return s;
}

// Compute per-product revenue-critical time metrics (Excel logic).
function productMetrics(survey, med) {
    const t_vto = dayDiff(survey.f_eta, med.f_vto);
    const t_disp = dayDiff(survey.f_eta, survey.f_disp);
    const v_util = dayDiff(med.f_vto, survey.f_disp);
    return {
        is_expired: med.f_vto && survey.f_eta ? med.f_vto < survey.f_eta : null,
        t_vto,   // días vencido acumulado en hogar
        t_disp,  // ciclo total entrega -> encuesta
        v_util,  // ventana de vida útil al entregar
    };
}

module.exports = {
    ENUMS,
    CIUDADES,
    validateSurvey,
    calcEdad,
    dayDiff,
    productMetrics,
};
