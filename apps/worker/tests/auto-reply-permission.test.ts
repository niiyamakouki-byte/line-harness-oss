import { describe, it, expect } from 'vitest';

// Inline replica of checkAutoReplyPermission from apps/worker/src/routes/webhook.ts
// (function is not exported; tested here as a pure unit)
function checkAutoReplyPermission(
  friendRank: string,
  autoReply: { permission_mode: string; allowed_ranks: string | null },
): boolean {
  switch (autoReply.permission_mode) {
    case 'allow_all':
      return true;
    case 'deny_all':
      return false;
    case 'vip_only':
      return friendRank === 'vip';
    case 'by_rank': {
      if (!autoReply.allowed_ranks) return true;
      try {
        const ranks = JSON.parse(autoReply.allowed_ranks) as string[];
        return ranks.includes(friendRank);
      } catch {
        return true;
      }
    }
    default:
      return true;
  }
}

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
