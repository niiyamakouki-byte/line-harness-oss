import { describe, expect, it } from 'vitest';
import worker from '../src/index.js';
import type { Env } from '../src/index.js';

describe('worker health endpoint', () => {
  it('returns worker status without auth', async () => {
    const response = await worker.fetch(
      new Request('https://example.com/health'),
      {} as Env,
      { waitUntil() {}, passThroughOnException() {} } as ExecutionContext,
    );

    expect(response.status).toBe(200);

    const body = await response.json() as {
      success: boolean;
      data: { service: string; status: string; timestamp: string };
    };

    expect(body.success).toBe(true);
    expect(body.data.service).toBe('worker');
    expect(body.data.status).toBe('ok');
    expect(Number.isNaN(Date.parse(body.data.timestamp))).toBe(false);
  });
});
