// Verifies that proxy trust is opt-in via TRUST_PROXY. Trusting a proxy makes
// Express derive the client IP from X-Forwarded-For, so an untrusted default is
// what stops direct-to-internet clients from spoofing that header to dodge the
// rate limits.
describe('trust proxy configuration', () => {
    const originalTrustProxy = process.env.TRUST_PROXY;

    const loadApp = (value) => {
        jest.resetModules();
        if (value === undefined) {
            delete process.env.TRUST_PROXY;
        } else {
            process.env.TRUST_PROXY = value;
        }
        return require('../src/index');
    };

    afterEach(() => {
        if (originalTrustProxy === undefined) {
            delete process.env.TRUST_PROXY;
        } else {
            process.env.TRUST_PROXY = originalTrustProxy;
        }
    });

    it('disables proxy trust by default (blocks X-Forwarded-For spoofing)', () => {
        expect(loadApp(undefined).get('trust proxy')).toBe(false);
    });

    it('treats a blank value as disabled', () => {
        expect(loadApp('   ').get('trust proxy')).toBe(false);
    });

    it('trusts a configured number of proxy hops', () => {
        expect(loadApp('2').get('trust proxy')).toBe(2);
    });

    it('accepts boolean strings', () => {
        expect(loadApp('true').get('trust proxy')).toBe(true);
        expect(loadApp('false').get('trust proxy')).toBe(false);
    });

    it('passes IP / subnet / preset lists through to Express', () => {
        expect(loadApp('loopback, 10.0.0.0/8').get('trust proxy')).toBe('loopback, 10.0.0.0/8');
    });
});
