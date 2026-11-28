import { ENDPOINT_TYPE } from '@cherrystudio/provider-registry';
import { normalizeContext } from '@earendil-works/pi-ai/utils/transcript';

import { prepareProviderImage } from '@/backend/services/file/importedImageNormalization';

import { bindPiStream, resolvePiApiAdapter } from '../piApiAdapters';
import type { PiStreamFn } from '../piModelTypes';

jest.mock('@/backend/services/file/importedImageNormalization', () => ({
  prepareProviderImage: jest.fn(),
}));

test('bound Anthropic transport prepares images after caller payload changes, including old nested history', async () => {
  jest.mocked(prepareProviderImage).mockResolvedValue({ data: 'bounded', mediaType: 'image/jpeg' });
  const sdk = jest.fn((..._args: Parameters<PiStreamFn>) => ({ marker: 'stream' }));
  const adapter = resolvePiApiAdapter(ENDPOINT_TYPE.ANTHROPIC_MESSAGES);
  const load = jest
    .spyOn(adapter, 'loadStreamSimple')
    .mockResolvedValue(sdk as unknown as PiStreamFn);
  try {
    const stream = await bindPiStream(adapter, {
      prepareImage: prepareProviderImage,
      apiKey: 'unused',
      fetch: jest.fn(),
      headers: {},
      maxRetries: 0,
      maxTokens: 1000,
    });
    const image = {
      type: 'image',
      source: { type: 'base64', media_type: 'image/png', data: 'old-large-image' },
    };
    const replacement = {
      messages: [
        { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't', content: [image] }] },
      ],
    };
    const model = { id: 'claude', api: 'anthropic-messages' } as Parameters<PiStreamFn>[0];
    await stream(model, normalizeContext({ messages: [] }), { onPayload: async () => replacement });
    const options = sdk.mock.calls[0]![2] as Parameters<PiStreamFn>[2];
    const payload = await options!.onPayload!({}, model);
    expect(payload).toMatchObject({
      messages: [
        { content: [{ content: [{ source: { data: 'bounded', media_type: 'image/jpeg' } }] }] },
      ],
    });
    expect(image.source.data).toBe('old-large-image');
    expect(prepareProviderImage).toHaveBeenCalledWith(
      { data: 'old-large-image', mediaType: 'image/png' },
      undefined,
    );
  } finally {
    load.mockRestore();
  }
});
