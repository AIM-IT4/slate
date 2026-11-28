import type { ResolvedFile } from '@/shared/contracts/file';

import { saveFileToDevice } from '../saveFileToDevice';

const mockPick = jest.fn();
const mockCopy = jest.fn();
const mockCleanup = jest.fn();
const mockExisting = new Set<string>();
let mockSourceExists = true;
const mockFolder = {
  uri: 'content://provider/opaque-selected-tree',
  info: () => ({ files: [...mockExisting] }),
};

jest.mock('expo-crypto', () => ({ randomUUID: () => 'unique-save-operation' }));
jest.mock('expo-file-system', () => ({
  Paths: { cache: 'file:///cache' },
  Directory: Object.assign(
    jest.fn((...parts: string[]) => ({
      uri: parts.join('/'),
      exists: true,
      create: jest.fn(),
      delete: mockCleanup,
    })),
    { pickDirectoryAsync: () => mockPick() },
  ),
  File: jest.fn((base: string | { uri: string }, name?: string) => {
    if (typeof base !== 'string' && base.uri.startsWith('content:'))
      throw new Error('Cannot guess a content-provider document URI');
    const uri = name ? `${typeof base === 'string' ? base : base.uri}/${name}` : base;
    return {
      uri,
      exists: mockSourceExists,
      copy: (destination: unknown, options: unknown) => mockCopy(uri, destination, options),
    };
  }),
}));

const file = (name: string) =>
  ({ uri: 'file:///private/managed-id.bin', entry: { filename: name } }) as ResolvedFile;

beforeEach(() => {
  jest.clearAllMocks();
  mockSourceExists = true;
  mockExisting.clear();
  mockPick.mockResolvedValue(mockFolder);
  mockCopy.mockResolvedValue(undefined);
});

it.each(['reel.mp4', 'voice.mp3', 'source.zip', 'script.py', 'report.pdf', '.gitignore'])(
  'exports the complete original with its readable name, not its internal UUID: %s',
  async (name) => {
    await expect(saveFileToDevice(file(name))).resolves.toBe(name);
    expect(mockCopy).toHaveBeenNthCalledWith(
      1,
      'file:///private/managed-id.bin',
      expect.objectContaining({ uri: expect.stringContaining(`/${name}`) }),
      { overwrite: false },
    );
    expect(mockCopy).toHaveBeenNthCalledWith(2, expect.stringContaining(`/${name}`), mockFolder, {
      overwrite: false,
    });
    expect(mockCleanup).toHaveBeenCalledTimes(1);
  },
);

it('keeps existing files and chooses a numbered name without replacing bytes', async () => {
  mockExisting.add('reel.mp4');
  mockExisting.add('reel (1).mp4');
  await expect(saveFileToDevice(file('reel.mp4'))).resolves.toBe('reel (2).mp4');
  expect(mockCopy.mock.calls[1][0]).toContain('/reel (2).mp4');
});

it('does not copy anything when the picker is dismissed or the source is missing', async () => {
  mockPick.mockRejectedValueOnce(new Error('Directory picker cancelled'));
  await expect(saveFileToDevice(file('reel.mp4'))).rejects.toThrow('cancelled');
  expect(mockCopy).not.toHaveBeenCalled();
  mockSourceExists = false;
  await expect(saveFileToDevice(file('reel.mp4'))).rejects.toThrow('unavailable');
  expect(mockPick).toHaveBeenCalledTimes(1);
});

it('honors cancellation after the picker and before exporting a staged file', async () => {
  const controller = new AbortController();
  mockPick.mockImplementationOnce(async () => {
    controller.abort();
    return mockFolder;
  });
  await expect(saveFileToDevice(file('reel.mp4'), controller.signal)).rejects.toThrow();
  expect(mockCopy).not.toHaveBeenCalled();
  const second = new AbortController();
  mockCopy.mockImplementationOnce(async () => second.abort());
  await expect(saveFileToDevice(file('reel.mp4'), second.signal)).rejects.toThrow();
  expect(mockCopy).toHaveBeenCalledTimes(1);
  expect(mockCleanup).toHaveBeenCalledTimes(1);
});

it('reports copy failure and removes only its own private staging directory', async () => {
  mockCopy.mockRejectedValueOnce(new Error('disk full'));
  await expect(saveFileToDevice(file('reel.mp4'))).rejects.toThrow('disk full');
  expect(mockCopy).toHaveBeenCalledTimes(1);
  expect(mockCleanup).toHaveBeenCalledTimes(1);
});
