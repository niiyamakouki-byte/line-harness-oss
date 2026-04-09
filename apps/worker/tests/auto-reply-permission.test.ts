import { describe, it, expect } from 'vitest';
import { checkAutoReplyPermission } from '../src/routes/auto-reply.js';

describe('checkAutoReplyPermission', () => {
  it('allow_all always returns true regardless of rank', () => {
    expect(checkAutoReplyPermission('regular', { permission_mode: 'allow_all', allowed_ranks: null })).toBe(true);
    expect(checkAutoReplyPermission('vip', { permission_mode: 'allow_all', allowed_ranks: null })).toBe(true);
  });

  it('deny_all always returns false', () => {
    expect(checkAutoReplyPermission('vip', { permission_mode: 'deny_all', allowed_ranks: null })).toBe(false);
    expect(checkAutoReplyPermission('regular', { permission_mode: 'deny_all', allowed_ranks: null })).toBe(false);
  });

  it('vip_only allows vip rank only', () => {
    expect(checkAutoReplyPermission('vip', { permission_mode: 'vip_only', allowed_ranks: null })).toBe(true);
    expect(checkAutoReplyPermission('regular', { permission_mode: 'vip_only', allowed_ranks: null })).toBe(false);
    expect(checkAutoReplyPermission('bronze', { permission_mode: 'vip_only', allowed_ranks: null })).toBe(false);
  });

  it('by_rank allows listed ranks', () => {
    const rule = { permission_mode: 'by_rank', allowed_ranks: '["vip","gold"]' };
    expect(checkAutoReplyPermission('vip', rule)).toBe(true);
    expect(checkAutoReplyPermission('gold', rule)).toBe(true);
    expect(checkAutoReplyPermission('regular', rule)).toBe(false);
  });

  it('by_rank with null allowed_ranks defaults to true', () => {
    expect(checkAutoReplyPermission('regular', { permission_mode: 'by_rank', allowed_ranks: null })).toBe(true);
  });

  it('by_rank with malformed JSON defaults to true', () => {
    expect(checkAutoReplyPermission('vip', { permission_mode: 'by_rank', allowed_ranks: 'not-json' })).toBe(true);
  });

  it('unknown permission_mode defaults to true', () => {
    expect(checkAutoReplyPermission('regular', { permission_mode: 'unknown_mode', allowed_ranks: null })).toBe(true);
  });
});
