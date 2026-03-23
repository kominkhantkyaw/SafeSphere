import { describe, expect, it } from 'vitest';
import { metricToReportBody } from './reportWebVitals';
import type { Metric } from 'web-vitals';

describe('metricToReportBody', () => {
    it('serialises Core Web Vitals fields and schema', () => {
        const metric = {
            name: 'LCP',
            value: 1234,
            rating: 'good',
            delta: 1234,
            id: 'metric-id',
            navigationType: 'navigate',
            entries: [],
        } as unknown as Metric;

        const body = metricToReportBody(metric);
        expect(body.schema).toBe('safesphere-web-vitals/v1');
        expect(body.name).toBe('LCP');
        expect(body.value).toBe(1234);
        expect(body.rating).toBe('good');
        expect(body.delta).toBe(1234);
        expect(body.id).toBe('metric-id');
        expect(body.navigationType).toBe('navigate');
        expect(typeof body.path).toBe('string');
    });
});
