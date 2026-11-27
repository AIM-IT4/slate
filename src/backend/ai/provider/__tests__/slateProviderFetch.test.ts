import { createSlateProviderFetch } from '../slateProviderFetch';

jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

test.each([
  ['openai', 'https://api.openai.com/v1/responses'],
  ['anthropic', 'https://api.anthropic.com/v1/messages'],
])('sends %s requests through a transport with redirects and cookies disabled', async (id, url) => {
  const nativeFetch = jest.fn(async () => new Response());
  const fetch = createSlateProviderFetch(id, nativeFetch);
  const headers = { 'x-api-key': 'test-only', Host: 'other.example', Cookie: 'private=1' };
  await fetch(url, { headers, redirect: 'follow', credentials: 'include' });
  expect(nativeFetch).toHaveBeenCalledWith(url, {
    headers: new Headers({ 'x-api-key': 'test-only' }),
    redirect: 'error',
    credentials: 'omit',
  });
});

test.each([
  'http://api.openai.com/v1',
  'https://api.openai.com.example.test/v1',
  'https://api.openai.com@other.example/v1',
  'https://user@api.openai.com/v1',
  'https://api.openai.com:8443/v1',
  'https://api.anthropic.com/v1',
])('blocks an OpenAI request to %s before invoking the native transport', async (url) => {
  const nativeFetch = jest.fn();
  const fetch = createSlateProviderFetch('openai', nativeFetch);
  await expect(fetch(url, { headers: { Authorization: 'Bearer test-only' } })).rejects.toThrow();
  expect(nativeFetch).not.toHaveBeenCalled();
});

const claudeMessagesUrl = 'https://api.anthropic.com/v1/messages';
const thinking = { type: 'thinking', thinking: '', signature: 'test-signature' };
const mismatch = {
  type: 'invalid_request_error',
  message:
    'messages.1.content.2: Invalid `signature` in `thinking` block. The block is bound to a different conversation. The `system` prompt differs.',
};

test('retries an Anthropic prefix mismatch once and keeps the chat text and tool exchange', async () => {
  const text = { type: 'text', text: 'Original answer' };
  const tool = { type: 'tool_use', id: 'toolu_test', name: 'lookup', input: {} };
  const messages = [
    { role: 'user', content: 'Original question' },
    { role: 'assistant', content: [thinking, text, thinking, tool] },
    { role: 'user', content: [{ type: 'tool_result', tool_use_id: tool.id, content: 'Result' }] },
    { role: 'assistant', content: [{ type: 'redacted_thinking', data: 'opaque' }] },
    { role: 'user', content: 'Follow-up question' },
  ];
  const payload = { model: 'claude-test', system: 'Updated instructions', messages };
  const rejection = () => Response.json({ error: mismatch }, { status: 400 });
  const finalFailure = rejection();
  const nativeFetch = jest
    .fn<ReturnType<typeof fetch>, Parameters<typeof fetch>>()
    .mockResolvedValueOnce(rejection())
    .mockResolvedValue(finalFailure);
  const send = createSlateProviderFetch('anthropic', nativeFetch);

  const response = await send(claudeMessagesUrl, {
    method: 'POST',
    body: JSON.stringify(payload),
  });

  expect(response).toBe(finalFailure);
  expect(nativeFetch).toHaveBeenCalledTimes(2);
  expect(JSON.parse(String(nativeFetch.mock.calls[1][1]?.body))).toEqual({
    ...payload,
    messages: [
      messages[0],
      { ...messages[1], content: [thinking, text, tool] },
      messages[2],
      messages[4],
    ],
  });
});

test('passes through other Anthropic 400 responses with their original body', async () => {
  const error = { ...mismatch, message: 'Invalid max_tokens' };
  const nativeFetch = jest.fn(async () => Response.json({ error }, { status: 400 }));
  const send = createSlateProviderFetch('anthropic', nativeFetch);
  const response = await send(claudeMessagesUrl, { method: 'POST', body: '{}' });

  expect(nativeFetch).toHaveBeenCalledTimes(1);
  await expect(response.json()).resolves.toEqual({ error });
});
