/**
 * 案件マッピング設定
 * ファイル名キーワード・送信者名から案件を特定するルールテーブル
 */

export interface ProjectInfo {
  company: string;
  project: string;
}

/** キーワードルール（優先度順に評価される） */
export interface KeywordRule {
  /** マッチパターン: 文字列の場合は部分一致、RegExp の場合はテスト */
  pattern: string | RegExp;
  company: string;
  project: string;
  /** 優先度（大きいほど先に評価）。デフォルト 0 */
  priority?: number;
}

export interface SenderRule {
  pattern: string | RegExp;
  company: string;
  /** 送信者に対するデフォルトプロジェクト。未設定の場合は keywordRules から推定 */
  defaultProject?: string;
}

export interface ProjectMap {
  /** ファイル名に対して評価するキーワードルール（priority 降順で評価） */
  keywordRules: KeywordRule[];
  /** 送信者名に対して評価するルール */
  senderRules: SenderRule[];
  discordChannels: {
    estimate: string;
    photo: string;
    expense: string;
  };
}

export const PROJECT_MAP: ProjectMap = {
  keywordRules: [
    // 高優先度: 具体的なプロジェクト識別子
    { pattern: /KDX/i,      company: 'MTM_Lab', project: 'KDX南青山_8-9F_リニューアル', priority: 10 },
    { pattern: /4PJ/,       company: 'MTM_Lab', project: '南青山4丁目_新築',            priority: 10 },
    { pattern: /アルペジオ/, company: 'MTM_Lab', project: 'アルペジオ',                 priority: 10 },
    // 中優先度: 通称・略称
    { pattern: /^Y_/,       company: 'MTM_Lab', project: 'アルペジオ',                 priority: 5 },
    { pattern: /MTM/,       company: 'MTM_Lab', project: '南青山4丁目_新築',            priority: 5 },
  ],
  senderRules: [
    { pattern: '阿部',     company: 'MTM_Lab', defaultProject: 'KDX南青山_8-9F_リニューアル' },
    { pattern: '由井',     company: 'MTM_Lab', defaultProject: '南青山4丁目_新築' },
    { pattern: '岩崎',     company: 'リップル', defaultProject: 'リップル_案件' },
    { pattern: '鈴木智里', company: 'csd_room', defaultProject: 'csd_room_案件' },
    { pattern: /^csd/i,    company: 'csd_room', defaultProject: 'csd_room_案件' },
  ],
  discordChannels: {
    estimate: '1488483262316941414',
    photo: '1488483264002920508',
    expense: '1488483265554939914',
  },
};
