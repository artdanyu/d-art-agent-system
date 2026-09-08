import { CONSULTANT_SYSTEM_PROMPT } from './dartConsultant.js';
import { formatKnowledgeForPrompt } from '../knowledge/dartKnowledge.js';
import {
  composeClientSystemPrompt,
  hasClientPack,
} from '../clients/compose.js';

/**
 * Системный текст для DeepSeek.
 * - Если задан `CLIENT_PROMPTS_HOT_RELOAD=1`, при каждом запросе читаются файлы из `clients/<папка>/`.
 * - Иначе используется `system_prompt` из БД (заполняется при старте из тех же файлов).
 * - Резерв для `default` без папки `clients/dart-art/`: промпт из кода + `formatKnowledgeForPrompt()`.
 */
export function buildSystemPrompt(agentId, agentRow) {
  if ((process.env.CLIENT_PROMPTS_HOT_RELOAD || '').trim() === '1') {
    const live = composeClientSystemPrompt(agentId);
    if (live) return live;
  }

  if (agentId === 'default' && !hasClientPack('default')) {
    return (
      CONSULTANT_SYSTEM_PROMPT +
      '\n\n---\n' +
      formatKnowledgeForPrompt()
    );
  }

  return agentRow.system_prompt;
}
