import { describe, it, expect } from 'vitest';
import { verifySignature } from '@line-crm/line-sdk';

// Helper: compute a valid HMAC-SHA256 base64 signature
async function computeSignature(secret: string, body: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signatureBytes = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const bytes = new Uint8Array(signatureBytes);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

describe('verifySignature', () => {
  const SECRET = 'test-channel-secret';
  const BODY = JSON.stringify({ destination: 'Udeadbeef', events: [] });

  it('returns true for a valid signature', async () => {
    const sig = await computeSignature(SECRET, BODY);
    const result = await verifySignature(SECRET, BODY, sig);
    expect(result).toBe(true);
  });

  it('returns false for a wrong secret', async () => {
    const sig = await computeSignature('wrong-secret', BODY);
    const result = await verifySignature(SECRET, BODY, sig);
    expect(result).toBe(false);
  });

  it('returns false for a malformed (non-base64) signature', async () => {
    const result = await verifySignature(SECRET, BODY, '!!!not-base64!!!');
    expect(result).toBe(false);
  });

  it('returns false for an empty signature', async () => {
    const result = await verifySignature(SECRET, BODY, '');
    expect(result).toBe(false);
  });

  it('returns true for an empty body with correct signature', async () => {
    const sig = await computeSignature(SECRET, '');
    const result = await verifySignature(SECRET, '', sig);
    expect(result).toBe(true);
  });

  it('returns false when body is tampered after signing', async () => {
    const sig = await computeSignature(SECRET, BODY);
    const tamperedBody = BODY.replace('Udeadbeef', 'Umodified');
    const result = await verifySignature(SECRET, tamperedBody, sig);
    expect(result).toBe(false);
  });
});
