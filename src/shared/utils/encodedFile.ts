import { convertBase64ToUint8Array } from '@ai-sdk/provider-utils';

import { imageMediaTypeFromHeader } from './imageFileTypes';

const MAX_ENVELOPE_CHARACTERS = 12 * 1024 * 1024;
const fields = ['content', 'data', 'base64', 'blob'] as const;
export type EncodedFile = {
  data: string;
  mediaType: string;
  bytes: number;
  name?: string;
  metadata: Record<string, unknown>;
};
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

/** Whole file envelopes only. Ordinary text, code examples and arbitrary base64 remain text. */
export function readEncodedFile(value: unknown): EncodedFile | undefined {
  if (typeof value === 'string') {
    if (value.length > MAX_ENVELOPE_CHARACTERS) return;
    const text = value.trim();
    if (text.startsWith('data:')) value = { content: text };
    else if (text.startsWith('{')) {
      try {
        value = JSON.parse(text);
      } catch {
        return;
      }
    } else return;
  }
  if (!object(value)) return;
  if (value.encoding !== undefined && value.encoding !== 'base64') return;
  for (const field of fields) {
    const raw = value[field];
    if (typeof raw !== 'string' || raw.length > MAX_ENVELOPE_CHARACTERS) continue;
    const uri = /^data:([\w.+-]+\/[\w.+-]+);base64,([\s\S]*)$/i.exec(raw);
    let data = (uri?.[2] ?? raw).replace(/[\r\n\t ]/g, '');
    if (!data || data.length % 4 === 1 || !/^[A-Za-z0-9+/]*={0,2}$/.test(data)) continue;
    data = data.padEnd(Math.ceil(data.length / 4) * 4, '=');
    let header: Uint8Array;
    try {
      header = convertBase64ToUint8Array(data.slice(0, 64));
    } catch {
      continue;
    }
    const declared = uri?.[1] ?? value.mimeType ?? value.mediaType ?? value.contentType;
    const signature = imageMediaTypeFromHeader(header) ?? binaryMediaType(header);
    const explicit =
      typeof declared === 'string' &&
      /^[\w.+-]+\/[\w.+-]+$/.test(declared) &&
      (uri || value.encoding === 'base64');
    const mediaType = signature ?? (explicit ? declared.toLowerCase() : undefined);
    if (!mediaType) continue;
    const metadata = Object.fromEntries(
      Object.entries(value).filter(
        ([key, item]) =>
          key !== '_meta' &&
          !(
            fields.includes(key as (typeof fields)[number]) &&
            typeof item === 'string' &&
            (item === raw ||
              item.replace(/[\r\n\t ]/g, '').replace(/=+$/, '') === data.replace(/=+$/, ''))
          ),
      ),
    );
    const name =
      typeof value.name === 'string'
        ? value.name
        : typeof value.filename === 'string'
          ? value.filename
          : undefined;
    return {
      data,
      mediaType,
      bytes:
        Math.floor((data.length * 3) / 4) - (data.endsWith('==') ? 2 : data.endsWith('=') ? 1 : 0),
      ...(name && name.length <= 255 && !/[\x00-\x1f/\\]/.test(name) ? { name } : {}),
      metadata,
    };
  }
}

/** Decode explicitly typed text files; HTML remains inert text at this boundary. */
export function decodeEncodedText(file: EncodedFile): string | undefined {
  if (!file.mediaType.startsWith('text/') && file.mediaType !== 'application/json') return;
  return new TextDecoder().decode(convertBase64ToUint8Array(file.data));
}

function binaryMediaType(bytes: Uint8Array): string | undefined {
  const ascii = String.fromCharCode(...bytes.subarray(0, 12));
  if (ascii.startsWith('%PDF-')) return 'application/pdf';
  if (ascii.startsWith('PK\x03\x04') || ascii.startsWith('PK\x05\x06')) return 'application/zip';
  if (ascii.startsWith('RIFF') && ascii.slice(8) === 'WAVE') return 'audio/wav';
  if (ascii.slice(4, 8) === 'ftyp') return 'video/mp4';
  if (ascii.startsWith('ID3')) return 'audio/mpeg';
  if (ascii.startsWith('fLaC')) return 'audio/flac';
}

export function encodedFileExtension(mediaType: string): string {
  return (
    (
      {
        'image/jpeg': 'jpg',
        'image/png': 'png',
        'image/gif': 'gif',
        'image/webp': 'webp',
        'image/avif': 'avif',
        'image/heic': 'heic',
        'image/heif': 'heif',
        'image/bmp': 'bmp',
        'image/tiff': 'tiff',
        'application/pdf': 'pdf',
        'application/zip': 'zip',
        'audio/wav': 'wav',
        'audio/mpeg': 'mp3',
        'audio/flac': 'flac',
        'audio/ogg': 'ogg',
        'audio/mp4': 'm4a',
        'audio/aac': 'aac',
        'video/mp4': 'mp4',
        'video/webm': 'webm',
        'text/plain': 'txt',
        'text/html': 'html',
        'application/json': 'json',
      } as Record<string, string>
    )[mediaType] ?? 'bin'
  );
}
