import { createUploadTask } from 'expo-file-system/legacy';

import { mcpServerService } from '@/backend/data/services/McpServerService';
import { transcribeVideoAudio } from '@/backend/services/voice/videoAudio';
import type { FileAttachmentFact } from '@/shared/contracts/fileAttachment';

import { readVideoUriContent } from '../videoContent';

jest.mock('@/backend/data/services/McpServerService', () => ({
  mcpServerService: { list: jest.fn() },
}));
jest.mock('@/backend/services/voice/videoAudio', () => ({ transcribeVideoAudio: jest.fn() }));
jest.mock('expo-file-system', () => ({
  File: class {
    exists = true;
    size = 123;
  },
}));
const mockUpload = jest.fn();
jest.mock('expo-file-system/legacy', () => ({
  createUploadTask: jest.fn(() => ({ uploadAsync: mockUpload, cancelAsync: jest.fn() })),
  FileSystemUploadType: { BINARY_CONTENT: 0 },
  FileSystemSessionType: { FOREGROUND: 0 },
}));
const fact = (id: string): FileAttachmentFact => ({
  fileEntryId: id,
  name: 'video.mp4',
  mediaType: 'video/mp4',
  size: 123,
});
const signal = () => new AbortController().signal;

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(mcpServerService.list).mockResolvedValue({
    items: [
      {
        endpointUrl: 'https://slate-execution.onrender.com/mcp',
        headers: { Authorization: 'Bearer test' },
      },
    ],
  } as never);
  mockUpload.mockResolvedValue({
    status: 200,
    body: JSON.stringify({
      durationSeconds: 1,
      workspacePath: 'uploads/' + 'a'.repeat(32) + '/source.video',
      frames: [{ timestampSeconds: 0, data: 'aGVsbG8=' }],
    }),
  });
});

test.each(['failed', 'partial'] as const)(
  'retrying %s audio reuses frames and retries recognition',
  async (status) => {
    jest
      .mocked(transcribeVideoAudio)
      .mockResolvedValueOnce({ status, processedSeconds: 0, segments: [] })
      .mockResolvedValueOnce({
        status: 'transcribed',
        processedSeconds: 1,
        segments: [{ startSeconds: 0, endSeconds: 1, text: 'Recovered narration.' }],
      });
    const file = fact('retry-' + status);
    const first = await readVideoUriContent('file:///clip.mp4', file, signal(), 12);
    expect(first.audio?.status).toBe(status);
    const second = await readVideoUriContent('file:///clip.mp4', file, signal(), 12);
    expect(second.audio).toMatchObject({
      status: 'transcribed',
      segments: [{ text: 'Recovered narration.' }],
    });
    expect(first.audio?.status).toBe(status);
    await readVideoUriContent('file:///clip.mp4', file, signal(), 12);
    expect(transcribeVideoAudio).toHaveBeenCalledTimes(2);
    expect(createUploadTask).toHaveBeenCalledTimes(1);
  },
);

test('a confirmed missing audio track is cached without pointless retries', async () => {
  jest
    .mocked(transcribeVideoAudio)
    .mockResolvedValue({ status: 'no-audio', processedSeconds: 0, segments: [] });
  await readVideoUriContent('file:///silent.mp4', fact('silent'), signal(), 12);
  await readVideoUriContent('file:///silent.mp4', fact('silent'), signal(), 12);
  expect(transcribeVideoAudio).toHaveBeenCalledTimes(1);
  expect(createUploadTask).toHaveBeenCalledTimes(1);
});
