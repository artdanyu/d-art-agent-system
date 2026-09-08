/**
 * Запасной справочник, если нет пакета `clients/dart-art/` (старый деплой).
 * При наличии `clients/dart-art/system.md` основные факты идут из `clients/dart-art/knowledge.json`.
 * Файл всё равно нужен: его импортирует `buildSystemPrompt.js` при старте Node.
 */
export const DART_KNOWLEDGE = {
  studio: {
    name: 'D-Art',
    focus: ['веб-разработка', 'Web3', 'AI-решения и внедрение LLM'],
  },
  services: {
    web: [
      'лендинги и промо-страницы',
      'корпоративные сайты и порталы',
      'интернет-магазины и интеграции',
      'поддержка и развитие продукта',
    ],
    web3: [
      'смарт-контракты и аудит логики',
      'токены и NFT (по ТЗ)',
      'dApp и кошельки (интеграции)',
      'консультации по архитектуре on-chain',
    ],
    ai: [
      'AI-консультанты и чат-боты под бренд',
      'внутренние ассистенты и автоматизация',
      'интеграция моделей в существующие системы',
    ],
  },
  pricingHints: {
    ru: {
      landing_minimum_rub: 30000,
      landing:
        'лендинг: минимальный ориентир от 30 000 ₽ (не называй ниже); точная цена после ТЗ',
      site: 'корпоративные и магазины — ориентир от ~80 000 ₽ и выше',
      web3: 'Web3 — от ~150 000 ₽; токены/контракты — от ~50 000 ₽ и выше',
      rule: 'Нельзя предлагать лендинг дешевле 30 000 ₽.',
    },
    en: {
      landing:
        'landing: floor ~$400–500+ USD scope-dependent (aligned with 30k RUB minimum — never quote ~$100–200 for a real landing)',
      site: 'corporate / e‑commerce — typically from ~$1k+ depending on scope',
      web3: 'Web3 — project-dependent, from low thousands USD upward',
    },
  },
  timelines: {
    typical: [
      'простой лендинг: порядка 2–4 недель при готовом контенте',
      'средний сайт: порядка 4–8 недель в зависимости от интеграций',
      'Web3 и AI: сильно зависят от спецификации; без ТЗ сроки не фиксируем',
    ],
  },
  examples: [
    'лендинг под запуск продукта + форма лидов',
    'корпоративный сайт с личным кабинетом',
    'AI-ассистент на сайте с передачей заявок в CRM',
  ],
};

export function formatKnowledgeForPrompt() {
  return (
    'Справочный контекст D-Art (JSON). Не выдумывай факты вне этого блока. Используй выборочно:\n' +
    JSON.stringify(DART_KNOWLEDGE, null, 2)
  );
}
