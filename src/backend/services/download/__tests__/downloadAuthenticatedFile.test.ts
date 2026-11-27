import { fetch as expoFetch } from 'expo/fetch';

import { hashLocalFile } from '@/backend/services/file/fileHash';

import { downloadAuthenticatedFile } from '../downloadAuthenticatedFile';

const mockFiles = new Map<string, Uint8Array>();
const mockMoves: string[] = [];
const mockReads: (() => void)[] = [];
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));
jest.mock('@/backend/services/file/fileHash', () => ({ hashLocalFile: jest.fn() }));
jest.mock('expo-file-system', () => ({
  FileMode: { ReadWrite: 3 },
  File: class {
    uri: string;
    constructor(value: string) {
      this.uri = value;
    }
    get exists() {
      return mockFiles.has(this.uri);
    }
    get size() {
      return mockFiles.get(this.uri)?.length ?? 0;
    }
    create() {
      mockFiles.set(this.uri, new Uint8Array());
    }
    open() {
      return {
        close: jest.fn(),
        writeBytesSync: (bytes: Uint8Array) => {
          const old = mockFiles.get(this.uri)!;
          const next = new Uint8Array(old.length + bytes.length);
          next.set(old);
          next.set(bytes, old.length);
          mockFiles.set(this.uri, next);
        },
      };
    }
    delete() {
      mockFiles.delete(this.uri);
    }
    move(destination: { uri: string }) {
      mockFiles.set(destination.uri, mockFiles.get(this.uri)!);
      mockFiles.delete(this.uri);
      mockMoves.push(destination.uri);
    }
  },
}));
const digest = 'a'.repeat(64);
const options = (signal = new AbortController().signal) => ({
  url: 'https://api.instabox.sh/v1/machines/m_1/files/content?path=%2Fdata%2Fvideo.mp4',
  origin: 'https://api.instabox.sh',
  headers: { Authorization: 'Bearer private-test-key' },
  destination: 'file:///cache/video',
  bytes: 6,
  sha256: digest,
  maxBytes: 100,
  timeoutMs: 10000,
  signal,
});
const response = (
  chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5, 6])],
  length = '6',
) => {
  let next = 0;
  const cancel = jest.fn(async () => {});
  return {
    status: 200,
    url: options().url,
    headers: new Headers({ 'content-length': length }),
    body: {
      cancel,
      getReader: () => ({
        cancel,
        read: async () => {
          mockReads.shift()?.();
          return next < chunks.length ? { done: false, value: chunks[next++] } : { done: true };
        },
      }),
    },
  };
};
beforeEach(() => {
  jest.clearAllMocks();
  mockFiles.clear();
  mockMoves.length = 0;
  mockReads.length = 0;
  jest.mocked(hashLocalFile).mockResolvedValue(digest);
  jest.mocked(expoFetch).mockResolvedValue(response() as never);
});

test('streams exact bytes, verifies a checksum, then publishes the finished file', async () => {
  await expect(downloadAuthenticatedFile(options())).resolves.toBe(options().destination);
  expect([...mockFiles.get(options().destination)!]).toEqual([1, 2, 3, 4, 5, 6]);
  expect(hashLocalFile).toHaveBeenCalledWith(
    `${options().destination}.part`,
    expect.any(AbortSignal),
  );
  expect(mockFiles.has(`${options().destination}.part`)).toBe(false);
  expect(expoFetch).toHaveBeenCalledWith(
    options().url,
    expect.objectContaining({ redirect: 'error', credentials: 'omit', headers: options().headers }),
  );
});
test.each([
  'http://api.instabox.sh/file',
  'https://api.instabox.sh.evil.test/file',
  'https://user:pass@api.instabox.sh/file',
])('rejects unsafe destinations before sending authentication: %s', async (url) => {
  await expect(downloadAuthenticatedFile({ ...options(), url })).rejects.toMatchObject({
    code: 'invalid-request',
  });
  expect(expoFetch).not.toHaveBeenCalled();
});
test.each([301, 302, 307, 308, 401, 404])(
  'does not follow HTTP %s or publish an error body',
  async (status) => {
    jest.mocked(expoFetch).mockResolvedValue({ ...response(), status } as never);
    await expect(downloadAuthenticatedFile(options())).rejects.toMatchObject({
      code: 'download',
      statusCode: status,
    });
    expect(expoFetch).toHaveBeenCalledTimes(1);
    expect(mockMoves).toHaveLength(0);
  },
);
test.each(['5', '7', 'invalid', ''])(
  'rejects a missing or unexpected declared size (%s)',
  async (length) => {
    jest.mocked(expoFetch).mockResolvedValue(response(undefined, length) as never);
    await expect(downloadAuthenticatedFile(options())).rejects.toMatchObject({
      code: 'verification',
    });
    expect(mockFiles.size).toBe(0);
  },
);
test('a truncated body or digest mismatch cannot become a completed attachment', async () => {
  jest.mocked(expoFetch).mockResolvedValue(response([new Uint8Array([1, 2, 3])]) as never);
  await expect(downloadAuthenticatedFile(options())).rejects.toMatchObject({
    code: 'verification',
  });
  expect(mockFiles.size).toBe(0);
  jest.mocked(expoFetch).mockResolvedValue(response() as never);
  jest.mocked(hashLocalFile).mockResolvedValue('b'.repeat(64));
  await expect(downloadAuthenticatedFile(options())).rejects.toMatchObject({
    code: 'verification',
  });
  expect(mockMoves).toHaveLength(0);
  expect(mockFiles.size).toBe(0);
});
test('joins cancellation and discards the partial file', async () => {
  const controller = new AbortController();
  mockReads.push(() => controller.abort());
  await expect(downloadAuthenticatedFile(options(controller.signal))).rejects.toBeDefined();
  expect(mockFiles.size).toBe(0);
  expect(mockMoves).toHaveLength(0);
});
