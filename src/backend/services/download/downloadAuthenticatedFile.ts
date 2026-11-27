import { File, FileMode } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';

import { hashLocalFile } from '@/backend/services/file/fileHash';

import { FileDownloadError } from './downloadFile';

/** Stream a private same-origin file without forwarding credentials through redirects. */
export async function downloadAuthenticatedFile(options: {
  url: string;
  origin: string;
  headers: Readonly<Record<string, string>>;
  destination: string;
  bytes: number;
  sha256: string;
  maxBytes: number;
  timeoutMs: number;
  signal: AbortSignal;
}): Promise<string> {
  const url = new URL(options.url);
  if (
    url.protocol !== 'https:' ||
    url.origin !== options.origin ||
    url.username ||
    url.password ||
    url.hash ||
    !options.destination.startsWith('file:///') ||
    options.destination.endsWith('/') ||
    !Number.isSafeInteger(options.bytes) ||
    options.bytes < 1 ||
    options.bytes > options.maxBytes ||
    !Number.isSafeInteger(options.maxBytes) ||
    options.maxBytes < 1 ||
    !Number.isSafeInteger(options.timeoutMs) ||
    options.timeoutMs < 1 ||
    !/^[a-f0-9]{64}$/.test(options.sha256)
  ) {
    throw new FileDownloadError('invalid-request');
  }
  options.signal.throwIfAborted();
  const controller = new AbortController();
  const signal = AbortSignal.any([options.signal, controller.signal]);
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const file = new File(`${options.destination}.part`);
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  let handle: ReturnType<File['open']> | undefined;
  let published = false;
  let verifying = false;
  const cancel = () => {
    void reader?.cancel().catch(() => undefined);
  };
  signal.addEventListener('abort', cancel, { once: true });
  try {
    const response = await expoFetch(options.url, {
      method: 'GET',
      headers: options.headers,
      redirect: 'error',
      credentials: 'omit',
      signal,
    });
    // Every redirect is rejected before its destination receives a request or credentials.
    if (response.status !== 200 || !response.body) {
      await response.body?.cancel();
      throw new FileDownloadError('download', response.status);
    }
    if (response.url && response.url !== options.url) {
      await response.body.cancel();
      throw new FileDownloadError('download');
    }
    const length = response.headers.get('content-length');
    if (!length || !/^\d+$/.test(length) || Number(length) !== options.bytes) {
      await response.body.cancel();
      throw new FileDownloadError('verification');
    }
    signal.throwIfAborted();
    file.create({ overwrite: true });
    handle = file.open(FileMode.ReadWrite);
    reader = response.body.getReader();
    let received = 0;
    while (true) {
      signal.throwIfAborted();
      const chunk = await reader.read();
      signal.throwIfAborted();
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > options.bytes) throw new FileDownloadError('verification');
      for (let offset = 0; offset < chunk.value.byteLength; offset += 65536) {
        handle.writeBytesSync(chunk.value.subarray(offset, offset + 65536));
      }
    }
    handle.close();
    handle = undefined;
    if (received !== options.bytes || file.size !== options.bytes)
      throw new FileDownloadError('verification');
    verifying = true;
    if ((await hashLocalFile(file.uri, signal)) !== options.sha256)
      throw new FileDownloadError('verification');
    signal.throwIfAborted();
    file.move(new File(options.destination));
    published = true;
    return options.destination;
  } catch (error) {
    options.signal.throwIfAborted();
    if (error instanceof FileDownloadError) throw error;
    throw new FileDownloadError(verifying ? 'verification' : 'download');
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', cancel);
    await reader?.cancel().catch(() => undefined);
    handle?.close();
    if (!published && file.exists) file.delete();
  }
}
