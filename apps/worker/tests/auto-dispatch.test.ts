import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { classifyFile, buildSavePath, analyzeFile, notifyDiscord } from '../src/services/auto-dispatch.js';
import { detectFileType, analyzeFileBuffer } from '../src/services/file-analyzer.js';

// ─── Helper: encode string to ArrayBuffer ────────────────────────────────────

function strToBuffer(s: string): ArrayBuffer {
  return new TextEncoder().encode(s).buffer;
}

// ─── detectFileType ─────────────────────────────────────────────────────────

describe('detectFileType', () => {
  it('PDF を判定する', () => {
    expect(detectFileType('見積書.pdf')).toBe('pdf');
    expect(detectFileType('PLAN.PDF')).toBe('pdf');
  });

  it('Excel を判定する', () => {
    expect(detectFileType('estimate.xlsx')).toBe('excel');
    expect(detectFileType('data.xls')).toBe('excel');
    expect(detectFileType('items.csv')).toBe('excel');
  });

  it('画像を判定する', () => {
    expect(detectFileType('photo.jpg')).toBe('image');
    expect(detectFileType('shot.jpeg')).toBe('image');
    expect(detectFileType('screen.png')).toBe('image');
  });

  it('不明なファイルを判定する', () => {
    expect(detectFileType('doc.docx')).toBe('unknown');
    expect(detectFileType('data.zip')).toBe('unknown');
  });
});

// ─── classifyFile ────────────────────────────────────────────────────────────

describe('classifyFile', () => {
  it('KDX をファイル名から判定する', () => {
    const result = classifyFile('KDX南青山_見積.pdf', '鈴木');
    expect(result.company).toBe('MTM_Lab');
    expect(result.project).toBe('KDX南青山_8-9F_リニューアル');
    expect(result.isUnknown).toBe(false);
  });

  it('4PJ をファイル名から判定する', () => {
    const result = classifyFile('4PJ_平面図.pdf', '鈴木');
    expect(result.company).toBe('MTM_Lab');
    expect(result.project).toBe('南青山4丁目_新築');
    expect(result.isUnknown).toBe(false);
  });

  it('アルペジオ をファイル名から判定する', () => {
    const result = classifyFile('アルペジオ_仕様書.pdf', '田中');
    expect(result.company).toBe('MTM_Lab');
    expect(result.project).toBe('アルペジオ');
  });

  it('Y_ プレフィックスでアルペジオに判定する', () => {
    const result = classifyFile('Y_design.pdf', '田中');
    expect(result.project).toBe('アルペジオ');
  });

  it('阿部 送信者でMTM_Labに判定する', () => {
    const result = classifyFile('見積書.pdf', '阿部太郎');
    expect(result.company).toBe('MTM_Lab');
    expect(result.isUnknown).toBe(false);
  });

  it('鈴木智里 送信者でcsd_roomに判定する', () => {
    const result = classifyFile('report.pdf', '鈴木智里');
    expect(result.company).toBe('csd_room');
  });

  it('csd で始まる送信者でcsd_roomに判定する（正規表現）', () => {
    const result = classifyFile('photo.jpg', 'csd_suzuki');
    expect(result.company).toBe('csd_room');
  });

  it('不明な場合は _未分類 にする', () => {
    const result = classifyFile('random_file.pdf', '謎の人');
    expect(result.company).toBe('_未分類');
    expect(result.project).toBe('_未分類');
    expect(result.isUnknown).toBe(true);
  });

  it('画像ファイルは photo チャンネルへ', () => {
    const result = classifyFile('KDX_photo.jpg', '阿部');
    expect(result.discordChannel).toBe('1488483264002920508');
  });

  it('Excel ファイルは expense チャンネルへ', () => {
    const result = classifyFile('KDX_estimate.xlsx', '阿部');
    expect(result.discordChannel).toBe('1488483265554939914');
  });

  it('PDF ファイルは estimate チャンネルへ', () => {
    const result = classifyFile('KDX_plan.pdf', '阿部');
    expect(result.discordChannel).toBe('1488483262316941414');
  });
});

// ─── buildSavePath ───────────────────────────────────────────────────────────

describe('buildSavePath', () => {
  it('正しいパスを組み立てる', () => {
    const cls = classifyFile('KDX_見積.pdf', '阿部');
    const path = buildSavePath('KDX_見積.pdf', cls);
    expect(path).toContain('/mtm-projects/MTM_Lab/KDX南青山_8-9F_リニューアル/KDX_見積.pdf');
  });

  it('不明案件は _未分類 パスに保存する', () => {
    const cls = classifyFile('unknown.pdf', '謎の人');
    const path = buildSavePath('unknown.pdf', cls);
    expect(path).toContain('/_未分類/_未分類/unknown.pdf');
  });
});

// ─── analyzeFile ─────────────────────────────────────────────────────────────

describe('analyzeFile', () => {
  it('空バッファでも DispatchResult を返す', () => {
    const result = analyzeFile('KDX_見積.pdf', '阿部', new ArrayBuffer(0));
    expect(result.classification.company).toBe('MTM_Lab');
    expect(result.savedPath).toContain('KDX_見積.pdf');
    expect(result.discordMessage).toContain('KDX_見積.pdf');
    expect(result.discordMessage).toContain('阿部');
  });

  it('不明案件では確認メッセージを含む', () => {
    const result = analyzeFile('random.pdf', '謎の人', new ArrayBuffer(0));
    expect(result.discordMessage).toContain('案件不明');
    expect(result.discordMessage).toContain('光輝さん確認');
  });

  it('discordMessage に保存先パスを含む', () => {
    const result = analyzeFile('4PJ_plan.pdf', '由井', new ArrayBuffer(0));
    expect(result.discordMessage).toContain('mtm-projects');
  });
});

// ─── analyzeFileBuffer (file-analyzer) ───────────────────────────────────────

describe('analyzeFileBuffer', () => {
  it('CSV バッファから見積項目を抽出する', () => {
    const csv = [
      '品名,数量,単価,金額',
      'フローリング材,50,3000,150000',
      '石膏ボード,100,500,50000',
      '合計,,,200000',
    ].join('\n');
    const result = analyzeFileBuffer('estimate.csv', strToBuffer(csv));
    expect(result.fileType).toBe('excel');
    expect(result.lineItems).toBeDefined();
    expect(result.lineItems!.length).toBeGreaterThan(0);
    expect(result.lineItems![0].name).toBe('フローリング材');
  });

  it('空のCSVでも解析エラーにならない', () => {
    const result = analyzeFileBuffer('empty.csv', strToBuffer(''));
    expect(result.fileType).toBe('excel');
    expect(result.lineItems).toBeDefined();
    expect(result.lineItems!.length).toBe(0);
  });

  it('PDF バッファ（空）でも解析エラーにならない', () => {
    const result = analyzeFileBuffer('plan.pdf', new ArrayBuffer(0));
    expect(result.fileType).toBe('pdf');
    expect(result.areas).toBeDefined();
  });

  it('PDF テキストから面積情報を抽出する', () => {
    // ASCII-range area patterns embedded in fake PDF content
    const fakePdf = 'BT (12.5m2 and 8.3) Tj ET floor area: 45.0m2';
    const result = analyzeFileBuffer('floor.pdf', strToBuffer(fakePdf));
    expect(result.fileType).toBe('pdf');
    expect(result.areas!.length).toBeGreaterThan(0);
  });

  it('画像ファイルは image タイプで分類される', () => {
    const result = analyzeFileBuffer('site_photo.jpg', new ArrayBuffer(0));
    expect(result.fileType).toBe('image');
    expect(result.summary).toContain('写真');
  });

  it('日報写真はファイル名から判定される', () => {
    const result = analyzeFileBuffer('日報_20240401.jpg', new ArrayBuffer(0));
    expect(result.fileType).toBe('image');
    expect(result.summary).toContain('日報');
  });

  it('不明ファイルは unknown タイプを返す', () => {
    const result = analyzeFileBuffer('document.docx', new ArrayBuffer(0));
    expect(result.fileType).toBe('unknown');
  });

  it('CSV の parseJpNumber が円記号・カンマに対応する', () => {
    const csv = '品名,金額\nタイル工事,"¥120,000"\n壁紙張り,"80,000円"';
    const result = analyzeFileBuffer('estimate.csv', strToBuffer(csv));
    expect(result.fileType).toBe('excel');
    // 項目が抽出されていること
    expect(result.lineItems!.length).toBeGreaterThan(0);
  });

  it('CSV の空行・ヘッダー行はスキップされる', () => {
    const csv = '\n品名,数量,金額\n\n工事A,1,50000\n\n工事B,2,30000\n';
    const result = analyzeFileBuffer('data.csv', strToBuffer(csv));
    expect(result.lineItems!.length).toBeGreaterThan(0);
    expect(result.lineItems![0].name).toBe('工事A');
  });
});

// ─── notifyDiscord ────────────────────────────────────────────────────────────

describe('notifyDiscord', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('DISCORD_BOT_TOKEN 未設定の場合は false を返す', async () => {
    const result = await notifyDiscord('1234567890', 'テストメッセージ', undefined);
    expect(result).toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('正常時は Discord API を呼び出して true を返す', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    const result = await notifyDiscord('1234567890', 'テストメッセージ', 'test-bot-token');
    expect(result).toBe(true);
    expect(mockFetch).toHaveBeenCalledOnce();

    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toContain('1234567890');
    expect(url).toContain('discord.com');
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bot test-bot-token');
  });

  it('Discord API がエラーを返した場合は false を返す', async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: false, status: 403, text: async () => 'Forbidden' });
    vi.stubGlobal('fetch', mockFetch);

    const result = await notifyDiscord('1234567890', 'テストメッセージ', 'test-bot-token');
    expect(result).toBe(false);
  });

  it('fetch 例外が発生した場合は false を返す', async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error('Network error'));
    vi.stubGlobal('fetch', mockFetch);

    const result = await notifyDiscord('1234567890', 'テストメッセージ', 'test-bot-token');
    expect(result).toBe(false);
  });
});
