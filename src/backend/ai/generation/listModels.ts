import {
  listModels as listPortableModels,
  type ModelListContext as PortableModelListContext,
} from '@cherrystudio/ai-runtime/provider';

import { createSlateProviderFetch } from '@/backend/ai/provider/slateProviderFetch';
import { defaultAppHeaders } from '@/backend/utils/defaultAppHeaders';
import type { Model } from '@/shared/data/types/model';
import type { Provider } from '@/shared/data/types/provider';
import { slateProviderOrigin } from '@/shared/utils/slateProviderOrigin';

export type ModelListContext = Omit<PortableModelListContext, 'appHeaders'>;

export function listModels(
  provider: Provider,
  context: ModelListContext,
  abortSignal?: AbortSignal,
  options?: { throwOnError?: boolean },
): Promise<Partial<Model>[]> {
  const providerId = provider.presetProviderId ?? provider.id;
  const origin = slateProviderOrigin(providerId);
  if (!origin) {
    return options?.throwOnError
      ? Promise.reject(new Error('Slate only supports Anthropic and OpenAI.'))
      : Promise.resolve([]);
  }
  return listPortableModels(
    provider,
    {
      ...context,
      appHeaders: defaultAppHeaders(),
      officialBaseUrl: origin,
      fetch: createSlateProviderFetch(providerId),
    },
    abortSignal,
    options,
  );
}
