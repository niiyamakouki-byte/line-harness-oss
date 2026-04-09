export type AutoReplyPermissionRule = {
  permission_mode: string;
  allowed_ranks: string | null;
};

export type PatternAutoReplyMatch = {
  matched: boolean;
  keyword: string | null;
  responseType: 'text';
  responseContent: string;
};

type PatternAutoReplyRule = {
  keyword: string;
  patterns: RegExp[];
  responseContent: string;
};

const PATTERN_AUTO_REPLY_RULES: PatternAutoReplyRule[] = [
  {
    keyword: '見積',
    patterns: [/見積/, /見積もり/, /お見積/],
    responseContent: [
      '見積のご相談ありがとうございます。',
      '以下を送っていただけると概算を出しやすいです。',
      '・現場名 / 住所',
      '・工事内容',
      '・寸法や面積',
      '・希望時期',
      '図面や写真があれば一緒に送ってください。',
    ].join('\n'),
  },
  {
    keyword: '工程',
    patterns: [/工程/, /工程表/, /スケジュール/, /着工/],
    responseContent: [
      '工程の確認ありがとうございます。',
      '調整のため、次の情報をお願いします。',
      '・現場名',
      '・希望着工日 / 完了希望日',
      '・作業できない曜日や時間帯',
      '・既存の工程表や図面',
      '共有いただければ確認しやすい順に整理します。',
    ].join('\n'),
  },
  {
    keyword: '写真',
    patterns: [/写真/, /画像/, /現場写真/],
    responseContent: [
      '写真の共有ありがとうございます。',
      '判断しやすくするため、可能なら次のカットをお願いします。',
      '・全体が分かる写真',
      '・気になる箇所のアップ',
      '・寸法やスケールが分かる写真',
      '複数枚まとめて送っていただいて大丈夫です。',
    ].join('\n'),
  },
  {
    keyword: '日報',
    patterns: [/日報/, /作業報告/, /進捗報告/],
    responseContent: [
      '日報ありがとうございます。',
      '次の形式で送っていただけると整理しやすいです。',
      '・現場名',
      '・本日の作業内容',
      '・人数',
      '・進捗 / 完了内容',
      '・課題 / 明日の予定',
    ].join('\n'),
  },
];

const FALLBACK_AUTO_REPLY: PatternAutoReplyMatch = {
  matched: false,
  keyword: null,
  responseType: 'text',
  responseContent: [
    'メッセージありがとうございます。',
    '自動案内できるキーワードは「見積」「工程」「写真」「日報」です。',
    '内容を続けて送っていただければ確認に必要な情報をご案内します。',
  ].join('\n'),
};

export function checkAutoReplyPermission(
  friendRank: string,
  autoReply: AutoReplyPermissionRule,
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

export function getPatternAutoReply(text: string): PatternAutoReplyMatch {
  const normalized = text.trim();

  for (const rule of PATTERN_AUTO_REPLY_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(normalized))) {
      return {
        matched: true,
        keyword: rule.keyword,
        responseType: 'text',
        responseContent: rule.responseContent,
      };
    }
  }

  return FALLBACK_AUTO_REPLY;
}
