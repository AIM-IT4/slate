import type { ListToolsResult } from '@modelcontextprotocol/client';
import { randomUUID } from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import {
  createUploadTask,
  FileSystemSessionType,
  FileSystemUploadType,
} from 'expo-file-system/legacy';
import * as z from 'zod';

import { fileEntryService } from '@/backend/data/services/FileEntryService';
import { downloadAuthenticatedFile, FileDownloadError } from '@/backend/services/download';
import { hashLocalFile } from '@/backend/services/file/fileHash';
import { createInternalEntryWithPreview } from '@/backend/services/file/filePreviewStorage';
import { discardInternalEntries, getInternalFileUri } from '@/backend/services/file/fileStorage';
import { loggerService } from '@/shared/core/logger/LoggerService';
import { FileEntryIdSchema, fileEntryUrl, SafeNameSchema } from '@/shared/data/types/file';

import type { RuntimeArtifact } from '../agent/runtime/types';

export const INSTABOX_SAVE_FILE_TOOL = 'slate_save_file_to_phone';
export const INSTABOX_UPLOAD_FILE_TOOL = 'slate_upload_file_to_instabox';
export const INSTABOX_FILE_MAX_BYTES = 2 * 1024 * 1024 * 1024;
const INSTABOX_LOCAL_TOOLS = new Set([INSTABOX_SAVE_FILE_TOOL, INSTABOX_UPLOAD_FILE_TOOL]);

export function isInstaboxLocalTool(name: string): boolean {
  return INSTABOX_LOCAL_TOOLS.has(name);
}
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

const MachineIdSchema = z
  .string()
  .min(1)
  .max(160)
  .regex(/^[a-zA-Z0-9_-]+$/);
const DataPathSchema = z
  .string()
  .min(1)
  .max(4096)
  .refine(
    (path) =>
      path.startsWith('/data/') &&
      !/[\u0000-\u001f\\]/.test(path) &&
      path.split('/').every((segment) => segment !== '.' && segment !== '..') &&
      !path.endsWith('/'),
  );

export const InstaboxFileInput = z
  .object({
    machine_id: MachineIdSchema,
    path: DataPathSchema,
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

export const InstaboxUploadInput = z
  .object({
    machine_id: MachineIdSchema,
    file_entry_id: FileEntryIdSchema,
    path: DataPathSchema,
  })
  .strict();

const uploadTool: ListToolsResult['tools'][number] = {
  name: INSTABOX_UPLOAD_FILE_TOOL,
  title: 'Upload a Slate file to Instabox',
  description:
    'Upload a managed file from this phone (for example a .zip, .tar, .apk, video or any attachment the user sent) to a running Instabox machine, so commands can extract, convert or inspect it. Supply machine_id, the file_entry_id from the attachment or file library, and an absolute destination path under /data (parent folders are created; an existing file is replaced). Slate streams the bytes with the saved Instabox connection and verifies size and SHA-256. Up to 2 GiB. Never supply credentials. After success, use exec on that machine, for example unzip -o <path> -d <folder>.',
  inputSchema: z.toJSONSchema(
    InstaboxUploadInput,
  ) as ListToolsResult['tools'][number]['inputSchema'],
  annotations: { readOnlyHint: false, openWorldHint: false },
};

/** Code-owned local tools, admitted only for the exact configured Instabox authority. */
export function withInstaboxFileTool(
  endpoint: string | null,
  tools: ListToolsResult['tools'],
): ListToolsResult['tools'] {
  if (!isInstaboxEndpoint(endpoint) || !tools.some((tool) => tool.name === 'exec')) return tools;
  return [...tools.filter((tool) => !INSTABOX_LOCAL_TOOLS.has(tool.name)), fileTool, uploadTool];
}

/** Copy only API authentication, never arbitrary MCP transport headers or cookies. */
function instaboxAuthorization(headers: Readonly<Record<string, string>> | undefined): string {
  const auth = new Map(
    Object.entries(headers ?? {}).map(([name, value]) => [name.toLowerCase(), value]),
  );
  const apiKey = auth.get('x-api-key')?.trim();
  const bearer = auth.get('authorization')?.trim();
  const authorization = apiKey ? `Bearer ${apiKey}` : bearer;
  if (!authorization || !/^Bearer [^\s\r\n]+$/i.test(authorization))
    throw new Error('Instabox authentication is unavailable');
  return authorization;
}

export function instaboxFileRequest(
  input: unknown,
  headers: Readonly<Record<string, string>> | undefined,
) {
  const value = InstaboxFileInput.parse(input);
  const authorization = instaboxAuthorization(headers);
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

export function instaboxUploadRequest(
  input: unknown,
  headers: Readonly<Record<string, string>> | undefined,
) {
  const value = InstaboxUploadInput.parse(input);
  const authorization = instaboxAuthorization(headers);
  const url = new URL(
    `/v1/machines/${encodeURIComponent(value.machine_id)}/files`,
    INSTABOX_ORIGIN,
  );
  url.searchParams.set('path', value.path);
  url.searchParams.set('parents', 'true');
  return { value, url: url.href, headers: { Authorization: authorization } };
}

const FileWrittenSchema = z.object({
  path: z.string(),
  size: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
});

function toolText(text: string, isError = false) {
  const value = { ...(isError ? { isError: true } : {}), content: [{ type: 'text', text }] };
  return { value, modelResult: value, artifacts: [] as RuntimeArtifact[] };
}

type UploadableEntry = { id: string; filename: string; size: number };

/** Stream a managed phone file to the user's Instabox machine and verify what the server wrote. */
export async function uploadPhoneFileToInstabox(options: {
  input: unknown;
  headers?: Readonly<Record<string, string>>;
  signal: AbortSignal;
  findEntry?: (id: string) => Promise<UploadableEntry | null>;
}): Promise<{ value: unknown; modelResult: unknown; artifacts: RuntimeArtifact[] }> {
  let upload: ReturnType<typeof createUploadTask> | undefined;
  const cancel = () => {
    void upload?.cancelAsync().catch(() => undefined);
  };
  options.signal.addEventListener('abort', cancel, { once: true });
  const timeout = setTimeout(cancel, 30 * 60_000);
  try {
    const request = instaboxUploadRequest(options.input, options.headers);
    const entry = await (options.findEntry
      ? options.findEntry(request.value.file_entry_id)
      : fileEntryService.findById(request.value.file_entry_id));
    options.signal.throwIfAborted();
    if (!entry) return toolText('That file_entry_id is not available on this phone.', true);
    const uri = getInternalFileUri(entry);
    const file = uri ? new File(uri) : undefined;
    if (!uri || !file?.exists)
      return toolText('The file bytes are not available on this phone.', true);
    const size = file.size;
    if (!Number.isSafeInteger(size) || size < 0 || size > INSTABOX_FILE_MAX_BYTES)
      return toolText(
        `The file is larger than the ${INSTABOX_FILE_MAX_BYTES}-byte upload limit.`,
        true,
      );
    const digest = await hashLocalFile(uri, options.signal);
    upload = createUploadTask(request.url, uri, {
      httpMethod: 'PUT',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      sessionType: FileSystemSessionType.FOREGROUND,
      headers: {
        ...request.headers,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(size),
      },
    });
    const response = await upload.uploadAsync();
    options.signal.throwIfAborted();
    if (!response || (response.status !== 200 && response.status !== 201))
      return toolText(
        `Instabox rejected the upload (HTTP ${response?.status ?? 'none'}). Check that the machine is running and the path is writable, then retry.`,
        true,
      );
    const written = FileWrittenSchema.parse(JSON.parse(response.body));
    if (written.size !== size || written.sha256 !== digest)
      return toolText(
        'Upload verification failed: the machine received different bytes. Retry the upload.',
        true,
      );
    return toolText(
      `Uploaded ${entry.filename} (${size} bytes) to ${written.path} on machine ${request.value.machine_id}. SHA-256 verified. Use exec on that machine to extract or process it.`,
    );
  } catch (error) {
    options.signal.throwIfAborted();
    logger.warn('Instabox upload failed', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return toolText(
      'Could not upload the file to Instabox. Check the machine ID, the destination path under /data and the file reference, then retry.',
      true,
    );
  } finally {
    clearTimeout(timeout);
    options.signal.removeEventListener('abort', cancel);
  }
}
