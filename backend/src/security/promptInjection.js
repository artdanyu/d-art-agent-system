/**
 * Обнаружение и смягчение prompt injection (лёгкие эвристики, без LLM).
 */

const LINE_PATTERNS = [
  /\bignore\s+(all\s+)?(previous|prior|above)\s+instructions?\b/i,
  /\bdisregard\s+(the\s+)?(system|above)\b/i,
  /\byou\s+are\s+now\b/i,
  /\bact\s+as\s+/i,
  /\bpretend\s+(you are|to be)\b/i,
  /\bnew\s+instructions?\s*:/i,
  /\bsystem\s*prompt\b/i,
  /\bshow\s+(me\s+)?(the\s+)?(hidden\s+)?(system\s+)?prompt\b/i,
  /\bjailbreak\b/i,
  /\bDAN\b.*\bmode\b/i,
  /\bdeveloper\s+mode\b/i,
  /игнорируй\s+(все\s+)?(предыдущие\s+)?инструкции/i,
  /забудь\s+(все\s+)?правила/i,
  /ты\s+теперь\s+(не\s+)?консультант/i,
  /покажи\s+(скрытый\s+)?промпт/i,
];

const SCORE_PATTERNS = [
  { re: /ignore.*instruction/i, w: 3 },
  { re: /system\s*prompt/i, w: 3 },
  { re: /act\s*as/i, w: 2 },
  { re: /jailbreak/i, w: 3 },
  { re: /roleplay/i, w: 1 },
];

/**
 * @returns {{ text: string, score: number, blockModel: boolean }}
 * blockModel=true — не вызывать LLM; ответить заготовкой.
 */
export function analyzeUserMessage(raw) {
  if (!raw || typeof raw !== 'string') {
    return { text: '', score: 0, blockModel: true };
  }

  if (raw.length > 20000) {
    return { text: '[фильтр]', score: 99, blockModel: true };
  }

  let text = raw.replace(/\r\n/g, '\n');
  let score = 0;

  for (const p of LINE_PATTERNS) {
    if (p.test(text)) {
      text = text.replace(p, ' ');
      score += 2;
    }
  }

  const lower = text.toLowerCase();
  for (const { re, w } of SCORE_PATTERNS) {
    if (re.test(lower)) score += w;
  }

  text = text.replace(/\s+/g, ' ').trim();

  const blockModel = score >= 4 || (score >= 2 && text.length < 8);

  return {
    text: text.length ? text : '[фильтр]',
    score,
    blockModel,
  };
}
