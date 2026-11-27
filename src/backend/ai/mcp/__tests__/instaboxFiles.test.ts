import { downloadAuthenticatedFile } from '@/backend/services/download';
import { createInternalEntryWithPreview } from '@/backend/services/file/filePreviewStorage';

import {
  INSTABOX_SAVE_FILE_TOOL,
  INSTABOX_UPLOAD_FILE_TOOL,
  InstaboxFileInput,
  InstaboxUploadInput,
  instaboxUploadRequest,
  instaboxFileRequest,
  isInstaboxEndpoint,
  saveInstaboxFileToPhone,
  withInstaboxFileTool,
} from '../instaboxFiles';

jest.mock('@/backend/data/services/FileEntryService', () => ({ fileEntryService: {} }));
jest.mock('@/backend/services/download', () => ({
  downloadAuthenticatedFile: jest.fn(),
  FileDownloadError: class extends Error {},
}));
jest.mock('@/backend/services/file/filePreviewStorage', () => ({
  createInternalEntryWithPreview: jest.fn(),
}));
jest.mock('@/backend/services/file/fileStorage', () => ({ discardInternalEntries: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'test-staging' }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache/' },
  Directory: class {
    uri = 'file:///cache/InstaboxTransfers/test-staging/';
    exists = false;
    create() {
      this.exists = true;
    }
    delete() {
      this.exists = false;
    }
  },
  File: class {
    uri: string;
    constructor(directory: { uri: string }, name: string) {
      this.uri = directory.uri + name;
    }
  },
}));
const input = {
  machine_id: 'm_example',
  path: '/data/slate/outputs/reel.mp4',
  bytes: 123,
  sha256: 'a'.repeat(64),
};
const signal = () => new AbortController().signal;
beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(downloadAuthenticatedFile).mockResolvedValue('file:///cache/download');
  jest.mocked(createInternalEntryWithPreview).mockResolvedValue({
    id: '00000000-0000-4000-8000-000000000001',
    filename: 'reel.mp4',
    mediaType: 'video/mp4',
    size: 123,
  } as never);
});

test('only the exact Instabox endpoint receives the client delivery tool', () => {
  const exec = { name: 'exec', inputSchema: { type: 'object' as const } };
  expect(
    withInstaboxFileTool('https://api.instabox.sh/mcp', [exec]).map((tool) => tool.name),
  ).toEqual(['exec', INSTABOX_SAVE_FILE_TOOL, INSTABOX_UPLOAD_FILE_TOOL]);
  for (const endpoint of [
    'https://api.instabox.sh.evil.test/mcp',
    'https://evil.test/mcp',
    'http://api.instabox.sh/mcp',
    'https://api.instabox.sh/mcp?key=secret',
  ]) {
    expect(isInstaboxEndpoint(endpoint)).toBe(false);
    expect(withInstaboxFileTool(endpoint, [exec])).toEqual([exec]);
  }
  expect(withInstaboxFileTool('https://api.instabox.sh/mcp', [])).toEqual([]);
});
test.each([
  '/tmp/reel.mp4',
  '/data/../etc/shadow',
  '/data/slate/./reel.mp4',
  '/data/reel\u0000.mp4',
  '/data/folder/',
])('rejects nonpersistent, traversal or malformed paths: %s', (path) => {
  expect(InstaboxFileInput.safeParse({ ...input, path }).success).toBe(false);
});
test('builds the documented authenticated file route without putting a secret in its URL', () => {
  const request = instaboxFileRequest(input, {
    'X-API-Key': 'private-test-key',
    Cookie: 'do-not-send',
    'X-Unrelated': 'do-not-send',
  });
  expect(new URL(request.url).searchParams.get('path')).toBe(input.path);
  expect(request.url).not.toContain('private-test-key');
  expect(request.headers).toEqual({
    Authorization: 'Bearer private-test-key',
    Accept: 'application/octet-stream',
    'Accept-Encoding': 'identity',
  });
  expect(() => instaboxFileRequest(input, {})).toThrow();
});
test('downloads and verifies before publishing a managed file and local inline artifact', async () => {
  const result = await saveInstaboxFileToPhone({
    input,
    headers: { Authorization: 'Bearer private-test-key' },
    folderId: 'folder',
    signal: signal(),
  });
  expect(downloadAuthenticatedFile).toHaveBeenCalledWith(
    expect.objectContaining({
      bytes: 123,
      sha256: input.sha256,
      origin: 'https://api.instabox.sh',
    }),
  );
  expect(createInternalEntryWithPreview).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      source: 'uri',
      name: 'reel.mp4',
      provenance: 'generated',
      folderId: 'folder',
    }),
    expect.any(AbortSignal),
  );
  expect(result.artifacts).toMatchObject([
    { ref: { kind: 'managed-file' }, mediaType: 'video/mp4' },
  ]);
  expect(JSON.stringify(result)).not.toContain('private-test-key');
  expect(JSON.stringify(result)).not.toContain('file:///');
});
test('failed transfers never create local records and tell the agent to preserve the existing output', async () => {
  jest.mocked(downloadAuthenticatedFile).mockRejectedValue(new Error('private-test-key'));
  const result = await saveInstaboxFileToPhone({
    input,
    headers: { Authorization: 'Bearer private-test-key' },
    signal: signal(),
  });
  expect(createInternalEntryWithPreview).not.toHaveBeenCalled();
  expect(result.artifacts).toEqual([]);
  expect(result.value).toMatchObject({ isError: true });
  expect(JSON.stringify(result)).toContain('Do not re-render');
  expect(JSON.stringify(result)).not.toContain('private-test-key');
});

test('builds an authenticated upload request that creates parent folders and keeps secrets out of the URL', () => {
  const upload = {
    machine_id: 'm_example',
    file_entry_id: '00000000-0000-4000-8000-000000000001',
    path: '/data/slate/inputs/ripping-formats.zip',
  };
  const request = instaboxUploadRequest(upload, { 'X-API-Key': 'private-test-key', Cookie: 'no' });
  const url = new URL(request.url);
  expect(url.origin + url.pathname).toBe('https://api.instabox.sh/v1/machines/m_example/files');
  expect(url.searchParams.get('path')).toBe(upload.path);
  expect(url.searchParams.get('parents')).toBe('true');
  expect(request.url).not.toContain('private-test-key');
  expect(request.headers).toEqual({ Authorization: 'Bearer private-test-key' });
  expect(InstaboxUploadInput.safeParse({ ...upload, path: '/tmp/x.zip' }).success).toBe(false);
  expect(InstaboxUploadInput.safeParse({ ...upload, file_entry_id: 'nope' }).success).toBe(false);
});
