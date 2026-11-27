import type { ListToolsResult } from '@modelcontextprotocol/client';
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import * as z from 'zod';

import { fileEntryService } from '@/backend/data/services/FileEntryService';
import { downloadAuthenticatedFile, FileDownloadError } from '@/backend/services/download';
import { createInternalEntryWithPreview } from '@/backend/services/file/filePreviewStorage';
import { discardInternalEntries } from '@/backend/services/file/fileStorage';
import { loggerService } from '@/shared/core/logger/LoggerService';
import { fileEntryUrl, SafeNameSchema } from '@/shared/data/types/file';

import type { RuntimeArtifact } from '../agent/runtime/types';

export const INSTABOX_SAVE_FILE_TOOL = 'slate_save_file_to_phone';
export const INSTABOX_FILE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const logger = loggerService.withContext('InstaboxFiles');
const INSTABOX_ORIGIN = 'https://api.instabox.sh';

export function isInstaboxEndpoint(endpoint: string | null | undefined): boolean {
  try {
    const url = new URL(endpoint ?? '');
    return (
      url.origin === INSTABOX_ORIGIN &&
      url.pathname.replace(/\/$/, '') === '/mcp' &&
      !url.search &&
      !url.hash &&
      !url.username &&
      !url.password
    );
  } catch {
    return false;
  }
}

export const InstaboxFileInput = z
  .object({
    machine_id: z
      .string()
      .min(1)
      .max(160)
      .regex(/^[a-zA-Z0-9_-]+$/),
    path: z
      .string()
      .min(1)
      .max(4096)
      .refine(
        (path) =>
          path.startsWith('/data/') &&
          !/[\u0000-\u001f\\]/.test(path) &&
          path.split('/').every((segment) => segment !== '.' && segment !== '..') &&
          !path.endsWith('/'),
      ),
    bytes: z.number().int().min(1).max(INSTABOX_FILE_MAX_BYTES),
    sha256: z.string().regex(/^[a-f0-9]{64}$/),
  })
  .strict();

const fileTool: ListToolsResult['tools'][number] = {
  name: INSTABOX_SAVE_FILE_TOOL,
  title: 'Save completed file to Slate',
  description:
    'After a render or file generation has completed in Instabox, save the finished file directly to this phone. Slate verifies its exact byte count and SHA-256, stores it in the local file library, and displays supported media/documents/charts inline. This client-side tool uses the saved Instabox connection; never supply credentials or a public URL. Compute bytes with stat and sha256 with sha256sum after closing the output. Up to 2 GiB, path under /data. Keeps the remote original. On a transfer failure, retry saving the existing output instead of rendering it again.',
  inputSchema: z.toJSONSchema(InstaboxFileInput) as ListToolsResult['tools'][number]['inputSchema'],
  annotations: { readOnlyHint: true, openWorldHint: false },
};

/** A code-owned local tool, admitted only for the exact configured Instabox authority. */
export function withInstaboxFileTool(
  endpoint: string | null,
  tools: ListToolsResult['tools'],
): ListToolsResult['tools'] {
  if (!isInstaboxEndpoint(endpoint) || !tools.some((tool) => tool.name === 'exec')) return tools;
  return [...tools.filter((tool) => tool.name !== INSTABOX_SAVE_FILE_TOOL), fileTool];
}

export function instaboxFileRequest(
  input: unknown,
  headers: Readonly<Record<string, string>> | undefined,
) {
  const value = InstaboxFileInput.parse(input);
  // Copy only API authentication, never arbitrary MCP transport headers or cookies.
  const auth = new Map(
    Object.entries(headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const apiKey = auth.get('x-api-key')?.trim();
  const bearer = auth.get('authorization')?.trim();
  const authorization = apiKey ? `Bearer ${apiKey}` : bearer;
  if (!authorization || !/^Bearer [^\s\r\n]+$/i.test(authorization))
    throw new Error('Instabox authentication is unavailable');
  const url = new URL(
    `/v1/machines/${encodeURIComponent(value.machine_id)}/files/content`,
    INSTABOX_ORIGIN,
  );
  url.searchParams.set('path', value.path);
  const name = SafeNameSchema.parse(value.path.split('/').at(-1));
  return {
    value,
    name,
    url: url.href,
    origin: INSTABOX_ORIGIN,
    headers: {
      Authorization: authorization,
      Accept: 'application/octet-stream',
      'Accept-Encoding': 'identity',
    },
  };
}

export async function saveInstaboxFileToPhone(options: {
  input: unknown;
  headers?: Readonly<Record<string, string>>;
  folderId?: string | null;
  signal: AbortSignal;
}): Promise<{ value: unknown; modelResult: unknown; artifacts: RuntimeArtifact[] }> {
  const directory = new Directory(Paths.cache, 'InstaboxTransfers', randomUUID());
  let entry: Awaited<ReturnType<typeof createInternalEntryWithPreview>> | undefined;
  try {
    const request = instaboxFileRequest(options.input, options.headers);
    options.signal.throwIfAborted();
    directory.create({ intermediates: true });
    const destination = new File(directory, 'download').uri;
    await downloadAuthenticatedFile({
      ...request,
      destination,
      bytes: request.value.bytes,
      sha256: request.value.sha256,
      maxBytes: INSTABOX_FILE_MAX_BYTES,
      timeoutMs: 5 * 60_000,
      signal: options.signal,
    });
    entry = await createInternalEntryWithPreview(
      fileEntryService,
      {
        source: 'uri',
        uri: destination,
        name: request.name,
        provenance: 'generated',
        folderId: options.folderId,
      },
      options.signal,
    );
    options.signal.throwIfAborted();
    const value = {
      content: [
        {
          type: 'text',
          text: `Saved to this phone: ${entry.filename} (${entry.size} bytes). SHA-256 verified. The remote original was retained.`,
        },
        {
          type: 'resource_link',
          uri: fileEntryUrl(entry.id),
          name: entry.filename,
          mimeType: entry.mediaType,
        },
      ],
    };
    return {
      value,
      modelResult: value,
      artifacts: [
        {
          ref: { kind: 'managed-file', fileEntryId: entry.id },
          name: entry.filename,
          mediaType: entry.mediaType,
          kind: 'created',
        },
      ],
    };
  } catch (error) {
    if (entry) await discardInternalEntries(fileEntryService, [entry]);
    options.signal.throwIfAborted();
    const reason =
      error instanceof FileDownloadError
        ? `${error.code}${error.statusCode ? ` (${error.statusCode})` : ''}`
        : 'file unavailable';
    const value = {
      isError: true,
      content: [
        {
          type: 'text',
          text: `Could not save the completed file to this phone: ${reason}. No completed local file was published. Check the running machine, path, size, checksum and available phone storage, then retry this save tool. Do not re-render or delete the remote output merely because its transfer failed.`,
        },
      ],
    };
    return { value, modelResult: value, artifacts: [] };
  } finally {
    try {
      if (directory.exists) directory.delete();
    } catch {
      logger.warn('Instabox staging cleanup failed');
    }
  }
}
