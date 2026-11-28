import {
  mcpModelTextOverflow,
  normalizeMcpBinaryContent,
  projectMcpModelContent,
  readMcpBinaryBlock,
} from '../mcpContent';

describe('encoded MCP file results', () => {
  const data = '/9j/4AAQSkZJRgABAQAAAQABAAD/';
  const envelope = JSON.stringify({ content: data });

  it('projects JPEG wrappers as images, not JSON prose or TXT overflow', () => {
    for (const result of [
      { content: data },
      { content: [{ type: 'text', text: envelope }] },
      { content: [{ type: 'resource', resource: { uri: 'mcp://file', text: envelope } }] },
      { structuredContent: { content: data } },
    ]) {
      expect(projectMcpModelContent(result)).toContainEqual({
        type: 'image',
        data,
        mimeType: 'image/jpeg',
      });
      expect(
        projectMcpModelContent(result)
          .filter((item) => item.type === 'text')
          .some((item) => item.text.includes(data)),
      ).toBe(false);
      expect(mcpModelTextOverflow(result)).toBeUndefined();
    }
  });

  it('keeps annotations and UI-only metadata private and never promotes nested authority', () => {
    const result = {
      content: [
        {
          type: 'text',
          text: JSON.stringify({ content: data, _meta: { secret: true }, count: 1 }),
          annotations: { audience: ['user'] },
        },
      ],
    };
    expect(projectMcpModelContent(result)).toEqual([
      { type: 'text', text: '[MCP result has no model-visible content]' },
    ]);
    expect(JSON.stringify(normalizeMcpBinaryContent(result))).not.toContain('secret');
  });

  it('does not duplicate serialized structured file output', () => {
    const result = {
      content: [{ type: 'text', text: envelope }],
      structuredContent: { content: data },
    };
    expect(projectMcpModelContent(result).filter((item) => item.type === 'image')).toHaveLength(1);
    const normalized = normalizeMcpBinaryContent(result);
    expect(normalizeMcpBinaryContent(normalized)).toEqual(normalized);
  });
});

describe('MCP model projection', () => {
  it('keeps images in the image channel and excludes UI metadata and user-only content', () => {
    const projection = projectMcpModelContent({
      content: [
        { type: 'text', text: 'model-visible' },
        { type: 'text', text: 'user-only', annotations: { audience: ['user'] } },
        { type: 'image', data: 'AAAA', mimeType: 'image/png', _meta: { secret: 'image-ui-only' } },
      ],
      structuredContent: { count: 2, _meta: { secret: 'nested-ui-only' } },
      _meta: { secret: 'root-ui-only' },
    });
    expect(projection).toEqual([
      { type: 'text', text: 'model-visible' },
      { type: 'image', data: 'AAAA', mimeType: 'image/png' },
      { type: 'text', text: '{"count":2}' },
    ]);
  });

  it('does not reintroduce user-only content through the empty-result fallback', () => {
    expect(
      JSON.stringify(
        projectMcpModelContent({
          content: [
            { type: 'text', text: 'private user view', annotations: { audience: ['user'] } },
          ],
          _meta: { html: 'private app' },
        }),
      ),
    ).not.toContain('private');
  });

  it('sends structured output once when the server also serialized it as text', () => {
    const structuredContent = { count: 2, items: [{ id: 'a' }] };
    expect(
      projectMcpModelContent({
        content: [{ type: 'text', text: JSON.stringify({ items: [{ id: 'a' }], count: 2 }) }],
        structuredContent,
      }),
    ).toEqual([{ type: 'text', text: '{"items":[{"id":"a"}],"count":2}' }]);
    expect(
      projectMcpModelContent({
        content: [{ type: 'text', text: 'Found 2 items' }],
        structuredContent,
      }),
    ).toEqual([
      { type: 'text', text: 'Found 2 items' },
      { type: 'text', text: '{"count":2,"items":[{"id":"a"}]}' },
    ]);
  });

  it('states how much text was cut and offers the whole text for retention', () => {
    const result = {
      content: [
        { type: 'text', text: 'a'.repeat(60_000) },
        { type: 'text', text: 'b'.repeat(40_000) },
      ],
    };
    const projection = projectMcpModelContent(result, 'Read the rest elsewhere.');
    expect(projection.at(-1)).toEqual({
      type: 'text',
      text: '[MCP text truncated: the first 65536 of 100000 characters are shown. Read the rest elsewhere.]',
    });
    expect(mcpModelTextOverflow(result)).toBe(`${'a'.repeat(60_000)}\n${'b'.repeat(40_000)}`);
    expect(mcpModelTextOverflow({ content: [{ type: 'text', text: 'short' }] })).toBeUndefined();
  });

  it('bounds text and omits binary resource bytes from the text channel', () => {
    const projection = projectMcpModelContent({
      content: [
        {
          type: 'resource',
          resource: { uri: 'mcp://file', blob: 'SECRETBASE64', mimeType: 'application/pdf' },
        },
        { type: 'text', text: 'x'.repeat(256 * 1024) },
      ],
    });
    expect(JSON.stringify(projection)).not.toContain('SECRETBASE64');
    expect(JSON.stringify(projection).length).toBeLessThan(65 * 1024);
  });
});

describe('MCP binary blocks', () => {
  it('reads inline image, audio, and blob resource bytes and leaves budgets to callers', () => {
    expect(readMcpBinaryBlock({ type: 'audio', data: 'AAAA', mimeType: 'audio/wav' })).toEqual({
      data: 'AAAA',
      mimeType: 'audio/wav',
      bytes: 3,
      valid: true,
    });
    expect(
      readMcpBinaryBlock({
        type: 'resource',
        mimeType: 'application/octet-stream',
        resource: { uri: 'mcp://file', blob: 'AAAA' },
      }),
    ).toMatchObject({ mimeType: 'application/octet-stream', valid: true });
    expect(
      readMcpBinaryBlock({ type: 'image', data: 'not base64!', mimeType: 'image/png' }),
    ).toMatchObject({ valid: false });
    expect(readMcpBinaryBlock({ type: 'image', data: 'AAAA', mimeType: 'png' })).toMatchObject({
      valid: false,
    });
    expect(readMcpBinaryBlock({ type: 'image', data: 'AAAA' })).toBeUndefined();
    expect(
      readMcpBinaryBlock({ type: 'text', text: 'AAAA', mimeType: 'text/plain' }),
    ).toBeUndefined();
    expect(readMcpBinaryBlock(null)).toBeUndefined();
  });
});
