import { fetch as expoFetch } from 'expo/fetch';

import { slateProviderOrigin } from '@/shared/utils/slateProviderOrigin';

/** Check the final SDK request before credentials are passed to the native network stack. */
export function createSlateProviderFetch(
  providerId: string,
  transport: typeof fetch = expoFetch as unknown as typeof fetch,
): typeof fetch {
  const allowedOrigin = slateProviderOrigin(providerId);
  return async (input, init) => {
    const address = typeof input === 'string' || input instanceof URL ? input : input.url;
    const url = new URL(address);
    if (!allowedOrigin || url.origin !== allowedOrigin || url.username || url.password) {
      throw new Error('Slate blocked a request to an unapproved model provider endpoint.');
    }

    const isRequest = typeof input !== 'string' && !(input instanceof URL);
    const headers = new Headers(init?.headers ?? (isRequest ? input.headers : undefined));
    // The native stack chooses the authority from the verified URL and manages transport headers.
    headers.delete('host');
    headers.delete('proxy-authorization');
    headers.delete('cookie');

    const request = isRequest ? input : url.href;
    const options: RequestInit = {
      ...init,
      headers,
      credentials: 'omit',
      redirect: 'error',
    };
    const response = await transport(request, options);
    if (
      providerId !== 'anthropic' ||
      url.pathname !== '/v1/messages' ||
      response.status !== 400 ||
      typeof options.body !== 'string' ||
      options.signal?.aborted
    ) {
      return response;
    }

    const body = await withoutUnboundThinking(response, options.body);
    if (body === undefined || options.signal?.aborted) return response;
    // The server rejected the payload before generation. Retry once with the same credentials.
    void response.body?.cancel().catch(() => {});
    return transport(request, { ...options, body });
  };
}

async function withoutUnboundThinking(
  response: Response,
  body: string,
): Promise<string | undefined> {
  try {
    const error = (await response.clone().json())?.error;
    if (error?.type !== 'invalid_request_error' || typeof error.message !== 'string') return;
    const location =
      /^messages\.(\d+)\.content\.(\d+): Invalid `?signature`? in `?thinking`? block\. The block is bound to a different conversation\./.exec(
        error.message,
      );
    if (!location) return;
    const messageIndex = Number(location[1]);
    const blockIndex = Number(location[2]);
    const payload = JSON.parse(body);
    const messages = payload?.messages;
    if (!Array.isArray(messages) || messages[messageIndex]?.role !== 'assistant') return;
    const rejectedContent = messages[messageIndex].content;
    if (!Array.isArray(rejectedContent) || rejectedContent[blockIndex]?.type !== 'thinking') return;

    // A later signature can also depend on the rejected block. Keep text and tool blocks intact.
    return JSON.stringify({
      ...payload,
      messages: messages.flatMap((message, index) => {
        if (
          index < messageIndex ||
          message?.role !== 'assistant' ||
          !Array.isArray(message.content)
        )
          return [message];
        const content = message.content.filter(
          (block: { type?: string } | null, offset: number) =>
            (index === messageIndex && offset < blockIndex) ||
            (block?.type !== 'thinking' && block?.type !== 'redacted_thinking'),
        );
        return content.length ? [{ ...message, content }] : [];
      }),
    });
  } catch {
    // Preserve the provider's original response if either body cannot be inspected.
    return undefined;
  }
}
