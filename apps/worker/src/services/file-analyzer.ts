/**
 * ファイル分析モジュール
 *
 * - PDF  → テキスト抽出（面積・数量パターン検索）
 * - Excel/CSV → 見積項目・金額抽出
 * - 画像 → 写真として日報/現場写真に分類
 *
 * Cloudflare Workers 環境では Node.js ネイティブモジュール（fs, path 等）が
 * 使えないため、LINE Content API から取得した ArrayBuffer を直接解析する。
 * pdfplumber / openpyxl は Python ライブラリなので Workers では使用できず、
 * 代わりに軽量なバイト列解析でテキストを抽出する。
 */

export type FileType = 'pdf' | 'excel' | 'image' | 'unknown';

export interface AnalysisResult {
  fileType: FileType;
  summary: string;
  areas?: string[];      // 面積情報（PDF 図面向け）
  lineItems?: LineItem[]; // 見積項目（Excel 向け）
  notes: string[];
}

export interface LineItem {
  name: string;
  quantity?: string;
  unit?: string;
  unitPrice?: string;
  amount?: string;
}

/**
 * ファイル名から種別を判定する
 */
export function detectFileType(fileName: string): FileType {
  const lower = fileName.toLowerCase();
  if (lower.endsWith('.pdf')) return 'pdf';
  if (lower.endsWith('.xlsx') || lower.endsWith('.xls') || lower.endsWith('.csv')) return 'excel';
  if (
    lower.endsWith('.jpg') ||
    lower.endsWith('.jpeg') ||
    lower.endsWith('.png') ||
    lower.endsWith('.gif') ||
    lower.endsWith('.webp') ||
    lower.endsWith('.heic')
  ) return 'image';
  return 'unknown';
}

/**
 * ArrayBuffer からテキストを抽出してファイルを分析する
 * （Workers 環境では PDF/Excel の深い解析は行わず、可視テキストを抽出）
 */
export function analyzeFileBuffer(fileName: string, buffer: ArrayBuffer): AnalysisResult {
  const fileType = detectFileType(fileName);

  switch (fileType) {
    case 'pdf':
      return analyzePdfBuffer(buffer);
    case 'excel':
      return analyzeExcelBuffer(buffer);
    case 'image':
      return analyzeImage(fileName);
    default:
      return {
        fileType: 'unknown',
        summary: `未対応ファイル形式: ${fileName}`,
        notes: ['手動確認が必要です'],
      };
  }
}

/** PDF バッファから可視テキストを抽出 */
function analyzePdfBuffer(buffer: ArrayBuffer): AnalysisResult {
  const text = extractTextFromPdf(buffer);
  const areas = extractAreas(text);
  const notes: string[] = [];

  if (areas.length > 0) {
    notes.push(`面積情報 ${areas.length} 件を検出`);
  }

  const isFloorPlan =
    /平面図|断面図|立面図|図面|FL|GL|天井高|梁下/i.test(text);
  const isSpec =
    /仕様書|材料|品番|型番|メーカー/i.test(text);

  if (isFloorPlan) notes.push('図面ファイルと判定');
  if (isSpec) notes.push('仕様書ファイルと判定');

  return {
    fileType: 'pdf',
    summary: isFloorPlan
      ? `図面ファイル — 面積情報: ${areas.length > 0 ? areas.join(', ') : '抽出不可'}`
      : isSpec
        ? '仕様書ファイル'
        : `PDF ファイル（テキスト抽出: ${text.length} 文字）`,
    areas,
    notes,
  };
}

/** PDF バイナリから可視テキストを抽出（簡易版） */
function extractTextFromPdf(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const chars: string[] = [];
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    // ASCII 可視文字のみ抽出
    if (b >= 0x20 && b < 0x7f) {
      chars.push(String.fromCharCode(b));
    } else if (b === 0x0a || b === 0x0d) {
      chars.push(' ');
    }
  }
  return chars.join('');
}

/** テキストから面積情報を抽出（例: "12.5㎡", "30.00m2", "8畳"） */
function extractAreas(text: string): string[] {
  const patterns = [
    /\d+(?:\.\d+)?\s*[㎡m²]/g,
    /\d+(?:\.\d+)?\s*m2/gi,
    /\d+(?:\.\d+)?\s*坪/g,
    /\d+(?:\.\d+)?\s*畳/g,
  ];
  const results = new Set<string>();
  for (const pattern of patterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) results.add(m.trim());
    }
  }
  return Array.from(results).slice(0, 10); // 最大10件
}

/** Excel/CSV バッファを簡易解析（CSV は UTF-8 テキストとして処理） */
function analyzeExcelBuffer(buffer: ArrayBuffer): AnalysisResult {
  // CSV ファイルの場合はテキストとして解析
  const text = new TextDecoder('utf-8', { fatal: false, ignoreBOM: false }).decode(buffer);
  const lineItems = extractLineItemsFromCsv(text);

  // 合計金額を集計
  const total = lineItems.reduce((sum, item) => {
    const amount = parseJpNumber(item.amount ?? '');
    return sum + amount;
  }, 0);

  const notes: string[] = [];
  if (lineItems.length > 0) {
    notes.push(`見積項目 ${lineItems.length} 行を検出`);
  }
  if (total > 0) {
    notes.push(`合計金額概算: ${total.toLocaleString('ja-JP')} 円`);
  }

  return {
    fileType: 'excel',
    summary:
      lineItems.length > 0
        ? `見積書 — ${lineItems.length} 項目、合計概算 ${total > 0 ? total.toLocaleString('ja-JP') + ' 円' : '不明'}`
        : 'Excel/CSV ファイル（項目抽出不可）',
    lineItems,
    notes,
  };
}

/** CSV テキストから見積行を抽出 */
function extractLineItemsFromCsv(text: string): LineItem[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const items: LineItem[] = [];

  for (const line of lines.slice(0, 100)) { // 最大100行
    const cols = line.split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    if (cols.length < 2) continue;

    // 先頭カラムが品名っぽい行を抽出
    const name = cols[0];
    if (!name || /^(合計|小計|総計|消費税|Tax|合 計)/.test(name)) continue;
    if (name.length > 50) continue; // ヘッダーや長すぎる行をスキップ

    const item: LineItem = { name };
    // 数値カラムを金額として拾う
    for (let i = 1; i < cols.length; i++) {
      const n = parseJpNumber(cols[i]);
      if (n > 0) {
        if (!item.unitPrice) item.unitPrice = cols[i];
        else item.amount = cols[i];
      }
    }
    if (item.unitPrice || item.amount) {
      items.push(item);
    }
  }
  return items;
}

/** 日本語数値文字列をパース（カンマ・円記号除去） */
function parseJpNumber(s: string): number {
  const cleaned = s.replace(/[,，円¥￥\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

/** 画像ファイルの分類 */
function analyzeImage(fileName: string): AnalysisResult {
  const lower = fileName.toLowerCase();
  const isReport = /日報|報告|レポート|report/i.test(lower);
  const isDrawing = /図面|plan|drawing|layout/i.test(lower);

  return {
    fileType: 'image',
    summary: isReport
      ? '日報・報告写真'
      : isDrawing
        ? '図面写真'
        : '現場写真',
    notes: ['画像ファイルは目視確認を推奨'],
  };
}
