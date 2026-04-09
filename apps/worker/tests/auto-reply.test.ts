import { describe, expect, it } from 'vitest';
import { getPatternAutoReply } from '../src/routes/auto-reply.js';

describe('getPatternAutoReply', () => {
  it('見積キーワードに反応する', () => {
    const reply = getPatternAutoReply('見積をお願いしたいです');
    expect(reply.matched).toBe(true);
    expect(reply.keyword).toBe('見積');
    expect(reply.responseContent).toContain('概算');
    expect(reply.responseContent).toContain('図面や写真');
  });

  it('工程キーワードに反応する', () => {
    const reply = getPatternAutoReply('工程表を確認したい');
    expect(reply.matched).toBe(true);
    expect(reply.keyword).toBe('工程');
    expect(reply.responseContent).toContain('希望着工日');
  });

  it('写真キーワードに反応する', () => {
    const reply = getPatternAutoReply('現場写真を送ります');
    expect(reply.matched).toBe(true);
    expect(reply.keyword).toBe('写真');
    expect(reply.responseContent).toContain('全体が分かる写真');
  });

  it('日報キーワードに反応する', () => {
    const reply = getPatternAutoReply('本日の日報です');
    expect(reply.matched).toBe(true);
    expect(reply.keyword).toBe('日報');
    expect(reply.responseContent).toContain('本日の作業内容');
  });

  it('未一致メッセージはフォールバックを返す', () => {
    const reply = getPatternAutoReply('こんにちは');
    expect(reply.matched).toBe(false);
    expect(reply.keyword).toBeNull();
    expect(reply.responseContent).toContain('見積');
    expect(reply.responseContent).toContain('工程');
    expect(reply.responseContent).toContain('写真');
    expect(reply.responseContent).toContain('日報');
  });
});
