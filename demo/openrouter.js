/**
 * OpenRouter, called straight from the browser.
 *
 * The key lives in localStorage and goes nowhere except openrouter.ai. There
 * is no server in this demo — GitHub Pages is static — so the alternative to
 * "your key, your browser" is no live model at all.
 */

const API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const KEY = 'mdx-a2ui:openrouter';

export function loadSettings() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // A corrupt entry is not worth a broken page.
  }
  return {apiKey: '', model: 'anthropic/claude-sonnet-4.5'};
}

export function saveSettings(settings) {
  localStorage.setItem(KEY, JSON.stringify(settings));
}

/**
 * Stream a completion, calling `onText` with the whole document so far.
 *
 * The caller re-converts on every token: that is the demo. Anything cleverer
 * would hide the property being shown.
 */
export async function streamMdx({
  prompt,
  system,
  settings,
  onText,
  signal,
}) {
  const response = await fetch(API_URL, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model,
      stream: true,
      messages: [
        {role: 'system', content: system},
        {role: 'user', content: prompt},
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `OpenRouter ${response.status}: ${detail.slice(0, 200) || response.statusText}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';

  for (;;) {
    const {done, value} = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, {stream: true});

    // SSE frames are separated by a blank line; a frame can be split across
    // reads, so only whole ones are consumed here.
    const frames = buffer.split('\n\n');
    buffer = frames.pop() ?? '';

    for (const frame of frames) {
      for (const line of frame.split('\n')) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') return text;
        try {
          const delta = JSON.parse(data).choices?.[0]?.delta?.content;
          if (delta) {
            text += delta;
            onText(text);
          }
        } catch {
          // A partial JSON frame; the next read completes it.
        }
      }
    }
  }
  return text;
}
