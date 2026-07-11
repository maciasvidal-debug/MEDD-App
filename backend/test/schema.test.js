// Payload-size and numeric-range guards on survey validation.
const { validateSurvey } = require('../src/schema');

const med = () => ({ nm_med: 'Acetaminofén', dci: 'paracetamol', conc_med: 500, und_conc: 'mg', f_vto: '2030-01-01' });

// A body that is otherwise valid, so a single injected out-of-range field is the
// only reason validation should fail.
const validBody = (overrides = {}) => ({
    nui_etr: 1, f_eta: '2024-06-01', f_nac: '1990-01-01',
    est_salud: false, disp_med_vc: false, vto_med_nc: false,
    ...overrides,
});

describe('validateSurvey — medications length cap', () => {
    test('rejects an oversized medications array before mapping it', () => {
        const { value, errors } = validateSurvey({ medications: Array.from({ length: 101 }, med) });
        expect(errors.some((e) => /Demasiados medicamentos/.test(e))).toBe(true);
        // The abusive array is not materialised into the cleaned value.
        expect(value.medications).toEqual([]);
    });

    test('accepts a medications array at the maximum (100)', () => {
        const { value, errors } = validateSurvey({ medications: Array.from({ length: 100 }, med) });
        expect(errors.some((e) => /Demasiados medicamentos/.test(e))).toBe(false);
        expect(value.medications).toHaveLength(100);
    });
});

describe('validateSurvey — numeric range guards (pre-DB, avoids 22003 overflow)', () => {
    test('rejects CANT_MED above the INTEGER ceiling', () => {
        const { errors } = validateSurvey(validBody({ cant_med: 9999999999 }));
        expect(errors.some((e) => /CANT_MED/.test(e))).toBe(true);
    });

    test('accepts CANT_MED at the INTEGER ceiling (2147483647)', () => {
        const { errors } = validateSurvey(validBody({ cant_med: 2147483647 }));
        expect(errors.some((e) => /CANT_MED/.test(e))).toBe(false);
    });

    test('rejects NUI_ETR above the INTEGER ceiling', () => {
        const { errors } = validateSurvey(validBody({ nui_etr: 2147483648 }));
        expect(errors.some((e) => /NUI_ETR/.test(e))).toBe(true);
    });

    test('rejects PESO_MED_NC that overflows NUMERIC(12,2)', () => {
        const { errors } = validateSurvey(validBody({ peso_med_nc: 1e10 }));
        expect(errors.some((e) => /PESO_MED_NC/.test(e))).toBe(true);
    });

    test('rejects CONC_MED that overflows NUMERIC(12,3)', () => {
        const { errors } = validateSurvey(validBody({
            medications: [{ nm_med: 'X', conc_med: 1e9, und_conc: 'mg' }],
        }));
        expect(errors.some((e) => /CONC_MED/.test(e))).toBe(true);
    });

    test('accepts an in-range survey with no numeric errors', () => {
        const { errors } = validateSurvey(validBody({ cant_med: 10, peso_med_nc: 123.45 }));
        expect(errors).toEqual([]);
    });
});
