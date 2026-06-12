const request = require('supertest');
const express = require('express');

// We need to override the env var before requiring the app.
process.env.CORS_ORIGIN = '';

const app = require('../src/index');

describe('CORS Configuration', () => {
    it('should reject cross-origin preflight requests when CORS_ORIGIN is unset', async () => {
        const response = await request(app)
            .options('/api/surveys')
            .set('Origin', 'http://malicious.com')
            .set('Access-Control-Request-Method', 'GET');

        expect(response.status).toBe(204);
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });

    it('should reject normal cross-origin requests when CORS_ORIGIN is unset', async () => {
        const response = await request(app)
            .get('/health')
            .set('Origin', 'http://malicious.com');

        expect(response.status).toBe(200); // The route is reached but blocked by browser
        expect(response.headers['access-control-allow-origin']).toBeUndefined();
    });
});
