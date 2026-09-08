/**
 * Постобработка ответа консультанта: деловой стиль, без эмодзи, разумная длина.
 */
export function sanitizeReply(text, options = {}) {
  const maxLength = options.maxLength ?? 1800;
  if (typeof text !== 'string') return '';

  let s = text.trim();

  // Убрать эмодзи и пиктограммы (Unicode)
  try {
    s = s.replace(/\p{Extended_Pictographic}/gu, '');
  } catch (e) {
    s = s.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/g, '');
  }

  s = s.replace(/\uFE0F/g, '');
  s = s.replace(/\s+/g, ' ').trim();

  if (s.length <= maxLength) return s;

  let cut = s.slice(0, maxLength);
  const lastBreak = Math.max(
    cut.lastIndexOf('.'),
    cut.lastIndexOf('!'),
    cut.lastIndexOf('?'),
    cut.lastIndexOf('\n')
  );
  if (lastBreak > maxLength * 0.45) {
    cut = cut.slice(0, lastBreak + 1);
  }
  return cut.trim() + '…';
}
