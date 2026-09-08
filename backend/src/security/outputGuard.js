import { sanitizeReply } from '../utils/sanitizeReply.js';

const LEAK_PATTERNS = [
  /я\s+(как\s+)?(языковая\s+)?модель/gi,
  /as\s+an\s+ai\s+model/gi,
  /I\s+am\s+(an\s+)?AI/gi,
  /system\s*prompt/gi,
  /мой\s+системный\s+промпт/gi,
  /developer\s+message/gi,
  /\bsk-[a-zA-Z0-9]{16,}/gi,
  /\bBearer\s+[a-zA-Z0-9._-]{24,}/gi,
  /\bApi-Key\s+[a-zA-Z0-9._-]{8,}/gi,
];

/**
 * Постобработка ответа модели: эмодзи, длина, утечки «я ИИ», промпта.
 */
export function guardAssistantReply(raw, options = {}) {
  let s = sanitizeReply(raw, options);
  if (!s) return '';

  for (const re of LEAK_PATTERNS) {
    s = s.replace(re, ' ');
  }
  s = s.replace(/\s+/g, ' ').trim();

  if (s.length < 1) {
    return '';
  }
  return s;
}
