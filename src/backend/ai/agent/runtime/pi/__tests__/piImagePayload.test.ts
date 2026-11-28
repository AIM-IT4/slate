import { preparePiImagePayload } from '../piImagePayload';
const image = (data: string) => ({
  type: 'image',
  source: { type: 'base64', media_type: 'image/png', data },
  cache_control: { type: 'ephemeral' },
});

test('repairs an oversized image in old history and nested tool results without mutating stored messages', async () => {
  const old = image('oversized');
  const tool = { type: 'tool_result', tool_use_id: 'tool', content: [old] };
  const payload = {
    messages: [
      { role: 'user', content: [old] },
      ...Array.from({ length: 21 }, (_, i) => ({ role: 'user', content: [image('small-' + i)] })),
      { role: 'user', content: [tool] },
    ],
    tools: [{ input_schema: { const: old } }],
  };
  const original = JSON.stringify(payload);
  const prepare = jest.fn(async (input: { data: string; mediaType: string }) =>
    input.data === 'oversized' ? { data: 'resized', mediaType: 'image/jpeg' } : input,
  );
  const result = (await preparePiImagePayload(
    payload,
    'anthropic-messages',
    undefined,
    prepare,
  )) as typeof payload;
  expect(result.messages[0]!.content[0]).toMatchObject({
    source: { data: 'resized', media_type: 'image/jpeg' },
    cache_control: { type: 'ephemeral' },
  });
  expect(result.messages.at(-1)!.content[0]).toMatchObject({
    tool_use_id: 'tool',
    content: [{ source: { data: 'resized' } }],
  });
  expect(JSON.stringify(payload)).toBe(original);
  expect(result.tools).toBe(payload.tools);
  expect(prepare).toHaveBeenCalledTimes(22);
});

test('normalizes document image blocks but leaves opaque thinking, signatures, tool inputs and URLs alone', async () => {
  const opaque = { type: 'thinking', thinking: 'private', signature: 'opaque' };
  const tool = { type: 'tool_use', input: { content: [image('not-provider-content')] } };
  const url = { type: 'image', source: { type: 'url', url: 'https://example.com/image.png' } };
  const doc = { type: 'document', source: { type: 'content', content: [image('large')] } };
  const prepare = jest.fn(async () => ({ data: 'safe', mediaType: 'image/jpeg' }));
  const payload = { messages: [{ role: 'user', content: [opaque, tool, url, doc] }] };
  const result = (await preparePiImagePayload(
    payload,
    'anthropic-messages',
    undefined,
    prepare,
  )) as typeof payload;
  expect(result.messages[0]!.content.slice(0, 3)).toEqual([opaque, tool, url]);
  expect(result.messages[0]!.content[3]).toMatchObject({
    source: { content: [{ source: { data: 'safe' } }] },
  });
  expect(prepare).toHaveBeenCalledTimes(1);
});

test('skips other protocols, preserves already-safe payload identity and propagates cancellation/failure', async () => {
  const payload = { messages: [{ role: 'user', content: [image('safe')] }] };
  const prepare = jest.fn(async (input: { data: string; mediaType: string }) => input);
  await expect(
    preparePiImagePayload(payload, 'openai-responses', undefined, prepare),
  ).resolves.toBe(payload);
  expect(prepare).not.toHaveBeenCalled();
  await expect(
    preparePiImagePayload(payload, 'anthropic-messages', undefined, prepare),
  ).resolves.toBe(payload);
  prepare.mockRejectedValueOnce(new Error('decode failed'));
  await expect(
    preparePiImagePayload(payload, 'anthropic-messages', undefined, prepare),
  ).rejects.toThrow('decode failed');
  const controller = new AbortController();
  controller.abort();
  await expect(
    preparePiImagePayload(payload, 'anthropic-messages', controller.signal, prepare),
  ).rejects.toBeDefined();
});
