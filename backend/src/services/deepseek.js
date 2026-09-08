const DEEPSEEK_URL = 'https://api.deepseek.com/chat/completions';

export async function chatCompletion({
  messages,
  temperature = 0.65,
  maxTokens = 1200,
}) {
  const capped = Math.min(2048, Math.max(64, Number(maxTokens) || 1200));
  const key = (process.env.DEEPSEEK_API_KEY || '').trim();
  if (!key) {
    const err = new Error('DEEPSEEK_API_KEY is not set');
    err.statusCode = 503;
    throw err;
  }

  const res = await fetch(DEEPSEEK_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages,
      temperature,
      max_tokens: capped,
      stream: false,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg = data.error?.message || data.message || res.statusText || 'DeepSeek request failed';
    const err = new Error(msg);
    err.statusCode = res.status >= 500 ? 502 : 400;
    err.details = data;
    throw err;
  }

  const text = data.choices?.[0]?.message?.content;
  if (typeof text !== 'string') {
    const err = new Error('Unexpected DeepSeek response shape');
    err.statusCode = 502;
    throw err;
  }

  return { reply: text.trim(), raw: data };
}
