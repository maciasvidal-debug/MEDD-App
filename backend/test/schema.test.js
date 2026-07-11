// Payload-size guards on survey validation.
const { validateSurvey } = require('../src/schema');

const med = () => ({ nm_med: 'Acetaminofén', dci: 'paracetamol', conc_med: 500, und_conc: 'mg', f_vto: '2030-01-01' });

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
