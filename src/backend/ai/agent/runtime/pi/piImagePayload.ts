type PreparedImage = { data: string; mediaType: string };
export type PrepareProviderImage = (
  image: PreparedImage,
  signal?: AbortSignal,
) => Promise<PreparedImage>;

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Final wire guard covers replayed history, attachments, document images and nested tool results. */
export async function preparePiImagePayload(
  payload: unknown,
  api: string,
  signal: AbortSignal | undefined,
  prepare: PrepareProviderImage,
): Promise<unknown> {
  if (api !== 'anthropic-messages' || !record(payload) || !Array.isArray(payload.messages))
    return payload;
  // Repeated images in this request share work, without retaining image bytes after the request.
  const images = new Map<string, Map<string, PreparedImage>>();
  async function blocks(content: unknown[]): Promise<unknown[]> {
    let changed = false;
    const output: unknown[] = [];
    for (const block of content) {
      signal?.throwIfAborted();
      let next = block;
      if (record(block)) {
        const source = block.source;
        if (
          block.type === 'image' &&
          record(source) &&
          source.type === 'base64' &&
          typeof source.data === 'string' &&
          typeof source.media_type === 'string'
        ) {
          let byData = images.get(source.media_type);
          if (!byData) images.set(source.media_type, (byData = new Map()));
          let image = byData.get(source.data);
          if (!image) {
            image = await prepare({ data: source.data, mediaType: source.media_type }, signal);
            signal?.throwIfAborted();
            byData.set(source.data, image);
          }
          if (image.data !== source.data || image.mediaType !== source.media_type)
            next = {
              ...block,
              source: { ...source, data: image.data, media_type: image.mediaType },
            };
        } else if (block.type === 'tool_result' && Array.isArray(block.content)) {
          const nested = await blocks(block.content);
          if (nested !== block.content) next = { ...block, content: nested };
        } else if (
          block.type === 'document' &&
          record(source) &&
          source.type === 'content' &&
          Array.isArray(source.content)
        ) {
          const nested = await blocks(source.content);
          if (nested !== source.content)
            next = { ...block, source: { ...source, content: nested } };
        }
      }
      changed ||= next !== block;
      output.push(next);
    }
    return changed ? output : content;
  }
  let changed = false;
  const messages: unknown[] = [];
  for (const message of payload.messages) {
    signal?.throwIfAborted();
    let next = message;
    if (record(message) && Array.isArray(message.content)) {
      const content = await blocks(message.content);
      if (content !== message.content) next = { ...message, content };
    }
    changed ||= next !== message;
    messages.push(next);
  }
  return changed ? { ...payload, messages } : payload;
}
