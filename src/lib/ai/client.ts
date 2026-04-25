// Direct AI API client — no separate gateway needed

const KIMI_API_KEY = process.env.KIMI_CODE_API_KEY;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

const KIMI_BASE_URL = process.env.KIMI_BASE_URL || 'https://api.kimi.com/coding/v1';
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com/v1';

const KIMI_MODEL = process.env.KIMI_MODEL || 'kimi-for-coding';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-5';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

function getModelConfig(model: 'kimi' | 'claude') {
  if (model === 'kimi') {
    return {
      apiKey: KIMI_API_KEY,
      baseUrl: KIMI_BASE_URL,
      model: KIMI_MODEL,
      headers: {
        'Authorization': `Bearer ${KIMI_API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'KimiCLI/1.5',
      } as Record<string, string>,
    };
  }
  return {
    apiKey: ANTHROPIC_API_KEY,
    baseUrl: ANTHROPIC_BASE_URL,
    model: CLAUDE_MODEL,
    headers: {
      'x-api-key': `${ANTHROPIC_API_KEY}`,
      'Content-Type': 'application/json',
      'anthropic-version': '2023-06-01',
    } as Record<string, string>,
  };
}

export function isConfigured(model: 'kimi' | 'claude') {
  const config = getModelConfig(model);
  return !!config.apiKey && config.apiKey.length > 10 && !config.apiKey.includes('placeholder');
}

export async function testModel(model: 'kimi' | 'claude') {
  const config = getModelConfig(model);

  if (!isConfigured(model)) {
    return { success: false, error: `API key not configured for ${model}` };
  }

  try {
    if (model === 'kimi') {
      const res = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify({
          model: config.model,
          messages: [{ role: 'user', content: 'Say "Kimi is online" and nothing else.' }],
          max_tokens: 20,
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }

      const data = await res.json();
      return {
        success: true,
        response: data.choices?.[0]?.message?.content || 'No response',
        model: data.model,
      };
    } else {
      const res = await fetch(`${config.baseUrl}/messages`, {
        method: 'POST',
        headers: config.headers,
        body: JSON.stringify({
          model: config.model,
          max_tokens: 20,
          messages: [{ role: 'user', content: 'Say "Claude is online" and nothing else.' }],
        }),
      });

      if (!res.ok) {
        const text = await res.text();
        return { success: false, error: `HTTP ${res.status}: ${text.slice(0, 200)}` };
      }

      const data = await res.json();
      return {
        success: true,
        response: data.content?.[0]?.text || 'No response',
        model: data.model,
      };
    }
  } catch (err: any) {
    return { success: false, error: err.message || 'Network error' };
  }
}

export async function* streamChat(
  model: 'kimi' | 'claude',
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number }
) {
  const config = getModelConfig(model);

  if (!isConfigured(model)) {
    yield { error: `API key not configured for ${model}` };
    return;
  }

  try {
    let body: Record<string, unknown>;
    let endpoint: string;

    if (model === 'kimi') {
      endpoint = `${config.baseUrl}/chat/completions`;
      body = {
        model: config.model,
        messages,
        stream: true,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.7,
      };
    } else {
      endpoint = `${config.baseUrl}/messages`;
      const systemMsg = messages.find((m) => m.role === 'system')?.content;
      const chatMessages = messages.filter((m) => m.role !== 'system');
      body = {
        model: config.model,
        max_tokens: options?.maxTokens || 4096,
        temperature: options?.temperature ?? 0.7,
        ...(systemMsg ? { system: systemMsg } : {}),
        messages: chatMessages,
        stream: true,
      };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...config.headers,
        'Accept': 'text/event-stream',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const text = await res.text();
      yield { error: `HTTP ${res.status}: ${text.slice(0, 500)}` };
      return;
    }

    // Some APIs may return a regular JSON response even when stream: true is set.
    // Fall back to parsing JSON if the response is not SSE.
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('text/event-stream')) {
      try {
        const data = await res.json();
        if (model === 'kimi') {
          const text = data.choices?.[0]?.message?.content || '';
          if (text) yield { text };
        } else {
          const text = data.content?.[0]?.text || '';
          if (text) yield { text };
        }
      } catch {
        yield { error: 'Unexpected non-streaming response format' };
      }
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) {
      yield { error: 'No response body' };
      return;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') continue;

        if (trimmed.startsWith('data: ')) {
          try {
            const chunk = JSON.parse(trimmed.slice(6));

            if (model === 'kimi') {
              const delta = chunk.choices?.[0]?.delta?.content;
              if (delta) yield { text: delta };
            } else {
              if (chunk.type === 'content_block_delta' && chunk.delta?.text) {
                yield { text: chunk.delta.text };
              } else {
                const delta = chunk.delta?.text || chunk.content_block?.text;
                if (delta) yield { text: delta };
              }
            }

            if (chunk.error) {
              yield { error: chunk.error.message || 'Streaming error' };
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    }
  } catch (err: any) {
    yield { error: err.message || 'Network error' };
  }
}

export async function chatCompletion(
  model: 'kimi' | 'claude',
  messages: ChatMessage[],
  options?: { maxTokens?: number; temperature?: number }
): Promise<{ text: string; error?: string }> {
  const chunks: string[] = [];
  for await (const chunk of streamChat(model, messages, options)) {
    if ('error' in chunk) return { text: chunks.join(''), error: chunk.error };
    if ('text' in chunk) chunks.push(chunk.text);
  }
  return { text: chunks.join('') };
}
