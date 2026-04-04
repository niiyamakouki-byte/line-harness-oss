/**
 * 自動仕分けモジュール
 *
 * LINE で受信したファイルを案件ごとに仕分けして
 * ~/mtm-projects/{company}/{project}/ に保存し、
 * Discord #見積・積算 チャンネルに分析結果を通知する。
 *
 * LINE secret が未設定でもモジュール自体はロード可能。
 * ファイル保存は Worker 環境では実行できないため、
 * 保存先パスを返すだけにとどめ、実際の書き込みは
 * MCP サーバー側（Node.js）で行う想定。
 */

import { PROJECT_MAP, type ProjectInfo } from '../config/project-map.js';
import {
  analyzeFileBuffer,
  detectFileType,
  type AnalysisResult,
} from './file-analyzer.js';

// ─── 型定義 ──────────────────────────────────────────────────────────────────

export interface FileClassification {
  company: string;
  project: string;
  type: ReturnType<typeof detectFileType>;
  discordChannel: string;
  isUnknown: boolean;
}

export interface DispatchResult {
  classification: FileClassification;
  analysis: AnalysisResult;
  savedPath: string;
  discordMessage: string;
}

// ─── 公開 API ─────────────────────────────────────────────────────────────────

/**
 * ファイル名と送信者名から案件を分類する
 */
export function classifyFile(
  filename: string,
  senderName: string,
): FileClassification {
  const fileType = detectFileType(filename);

  // 1. ファイル名キーワードで判定（priority 降順でソート済み）
  const sortedRules = [...PROJECT_MAP.keywordRules].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );
  for (const rule of sortedRules) {
    if (matchesPattern(filename, rule.pattern)) {
      return buildClassification(
        { company: rule.company, project: rule.project },
        fileType,
        false,
      );
    }
  }

  // 2. 送信者名で判定
  for (const rule of PROJECT_MAP.senderRules) {
    if (matchesPattern(senderName, rule.pattern)) {
      const project = rule.defaultProject ?? findDefaultProject(rule.company);
      return buildClassification({ company: rule.company, project }, fileType, false);
    }
  }

  // 3. 不明 — 構造化ログに記録
  console.warn(
    JSON.stringify({
      level: 'warn',
      event: 'auto_dispatch_unclassified',
      filename,
      senderName,
      reason: 'no_matching_rule',
    }),
  );
  return buildClassification(
    { company: '_未分類', project: '_未分類' },
    fileType,
    true,
  );
}

/**
 * 分類結果からファイル保存先パスを返す
 * 実際の書き込みは呼び出し元が担当する
 */
export function buildSavePath(
  filename: string,
  classification: FileClassification,
): string {
  const base = `${getHomeDir()}/mtm-projects`;
  const { company, project } = classification;
  return `${base}/${company}/${project}/${filename}`;
}

/**
 * ファイルを分析して DispatchResult を生成する
 * （Worker 環境: buffer を受け取って分析するだけ）
 */
export function analyzeFile(
  filename: string,
  senderName: string,
  buffer: ArrayBuffer,
): DispatchResult {
  const classification = classifyFile(filename, senderName);
  const analysis = analyzeFileBuffer(filename, buffer);
  const savedPath = buildSavePath(filename, classification);
  const discordMessage = buildDiscordMessage(
    filename,
    senderName,
    classification,
    analysis,
    savedPath,
  );
  return { classification, analysis, savedPath, discordMessage };
}

/**
 * Discord チャンネルへ分析結果を投稿する
 * DISCORD_BOT_TOKEN 環境変数が設定されている場合のみ実行
 */
export async function notifyDiscord(
  channelId: string,
  message: string,
  botToken?: string,
): Promise<boolean> {
  if (!botToken) {
    console.warn('[auto-dispatch] DISCORD_BOT_TOKEN が未設定のため通知をスキップ');
    return false;
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bot ${botToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ content: message }),
      },
    );
    if (!res.ok) {
      const body = await res.text();
      console.error(`[auto-dispatch] Discord 投稿失敗: ${res.status} ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[auto-dispatch] Discord 投稿エラー:', err);
    return false;
  }
}

// ─── 内部ヘルパー ─────────────────────────────────────────────────────────────

function buildClassification(
  info: ProjectInfo,
  fileType: ReturnType<typeof detectFileType>,
  isUnknown: boolean,
): FileClassification {
  const discordChannel = resolveDiscordChannel(fileType);
  return {
    company: info.company,
    project: info.project,
    type: fileType,
    discordChannel,
    isUnknown,
  };
}

/** ファイル種別から適切な Discord チャンネルを選択 */
function resolveDiscordChannel(
  fileType: ReturnType<typeof detectFileType>,
): string {
  switch (fileType) {
    case 'image':
      return PROJECT_MAP.discordChannels.photo;
    case 'excel':
      return PROJECT_MAP.discordChannels.expense;
    case 'pdf':
    default:
      return PROJECT_MAP.discordChannels.estimate;
  }
}

/** 文字列または正規表現パターンに対してマッチを判定する */
function matchesPattern(value: string, pattern: string | RegExp): boolean {
  if (typeof pattern === 'string') {
    return value.includes(pattern);
  }
  return pattern.test(value);
}

/** 会社名からデフォルトプロジェクトを検索 */
function findDefaultProject(company: string): string {
  const rule = PROJECT_MAP.keywordRules.find((r) => r.company === company);
  return rule?.project ?? company;
}

/** Discord 投稿メッセージを組み立てる */
function buildDiscordMessage(
  filename: string,
  senderName: string,
  classification: FileClassification,
  analysis: AnalysisResult,
  savedPath: string,
): string {
  const lines: string[] = [];

  if (classification.isUnknown) {
    lines.push('**[LINE ファイル受信 — 案件不明]** 光輝さん確認をお願いします');
  } else {
    lines.push(`**[LINE ファイル受信]**`);
  }

  lines.push(`送信者: ${senderName}`);
  lines.push(`ファイル: \`${filename}\``);
  lines.push(`案件: ${classification.company} / ${classification.project}`);
  lines.push(`種別: ${analysis.summary}`);

  if (analysis.areas && analysis.areas.length > 0) {
    lines.push(`面積情報: ${analysis.areas.join(' / ')}`);
  }

  if (analysis.lineItems && analysis.lineItems.length > 0) {
    const preview = analysis.lineItems
      .slice(0, 3)
      .map((i) => `${i.name} ${i.amount ?? i.unitPrice ?? ''}`)
      .join(', ');
    lines.push(`見積項目（抜粋）: ${preview}…`);
  }

  if (analysis.notes.length > 0) {
    lines.push(`備考: ${analysis.notes.join(' / ')}`);
  }

  lines.push(`保存先: \`${savedPath}\``);

  return lines.join('\n');
}

/** ホームディレクトリを返す（Worker 環境では固定値） */
function getHomeDir(): string {
  return '/Users/koki';
}
