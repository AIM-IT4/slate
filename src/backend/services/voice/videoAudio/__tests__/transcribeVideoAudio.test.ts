import { acquireAsrWork } from '../../asrWorkLock';
import { audioLevels, measurePcmWave } from '../pcmMetrics';
import { transcribeVideoAudio } from '../transcribeVideoAudio';
import { openVideoWhisper } from '../whisperModel';

const mockRecognize = jest.fn(async () => 'Narration from the reel.');
const mockRelease = jest.fn(async () => {});
const mockDecode = jest.fn();
const mockDelete = jest.fn();
let mockWave: Uint8Array;

jest.mock('../../../../../../modules/voice-input', () => ({
  getVoiceInput: () => ({ decodeAudioChunk: (...args: unknown[]) => mockDecode(...args) }),
}));
jest.mock('../whisperModel', () => ({
  supportsVideoAudio: () => true,
  openVideoWhisper: jest.fn(async () => ({
    recognize: (...args: unknown[]) => mockRecognize(...(args as [])),
    release: () => mockRelease(),
  })),
}));
jest.mock('expo-file-system', () => ({
  File: class {
    exists = true;
    get size() {
      return mockWave.length;
    }
    async bytes() {
      return mockWave;
    }
    delete() {
      mockDelete();
    }
  },
}));

function pcm(amplitude = 0.5) {
  const bytes = new Uint8Array(44 + 32000),
    d = new DataView(bytes.buffer);
  for (const [offset, text] of [
    [0, 'RIFF'],
    [8, 'WAVE'],
    [12, 'fmt '],
    [36, 'data'],
  ] as const)
    for (let i = 0; i < text.length; i++) bytes[offset + i] = text.charCodeAt(i);
  d.setUint32(4, bytes.length - 8, true);
  d.setUint32(16, 16, true);
  d.setUint16(20, 1, true);
  d.setUint16(22, 1, true);
  d.setUint32(24, 16000, true);
  d.setUint32(28, 32000, true);
  d.setUint16(32, 2, true);
  d.setUint16(34, 16, true);
  d.setUint32(40, 32000, true);
  for (let i = 0; i < 16000; i++)
    d.setInt16(
      44 + i * 2,
      Math.round(Math.sin((i / 16000) * 2 * Math.PI * 440) * amplitude * 32767),
      true,
    );
  return bytes;
}
beforeEach(() => {
  jest.clearAllMocks();
  mockDecode.mockReset();
  mockRecognize.mockReset().mockResolvedValue('Narration from the reel.');
  mockWave = pcm();
});

test('decodes MP4 audio locally and supplies timestamped speech plus measured levels', async () => {
  mockDecode
    .mockResolvedValueOnce({ uri: 'file:///one.wav', totalSeconds: 2, endSeconds: 1 })
    .mockResolvedValueOnce({ uri: 'file:///two.wav', totalSeconds: 2, endSeconds: 2 });
  const result = await transcribeVideoAudio('file:///clip.mp4', new AbortController().signal);
  expect(result).toMatchObject({
    status: 'transcribed',
    processedSeconds: 2,
    segments: [
      { startSeconds: 0, endSeconds: 1, text: 'Narration from the reel.' },
      { startSeconds: 1, endSeconds: 2, text: 'Narration from the reel.' },
    ],
  });
  expect(result.levels?.rmsDbfs).toBeCloseTo(-9, 0);
  expect(mockDecode.mock.calls).toEqual([
    ['file:///clip.mp4', 0, 30],
    ['file:///clip.mp4', 1, 30],
  ]);
  expect(openVideoWhisper).toHaveBeenCalledTimes(1);
  expect(mockRelease).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledTimes(2);
});
test('reports missing audio without loading the speech model', async () => {
  mockDecode.mockRejectedValueOnce(new Error('No audio track'));
  await expect(
    transcribeVideoAudio('file:///silent.mp4', new AbortController().signal),
  ).resolves.toMatchObject({ status: 'no-audio', segments: [] });
  expect(openVideoWhisper).not.toHaveBeenCalled();
});
test('does not invent speech for a silent soundtrack', async () => {
  mockWave = pcm(0);
  mockDecode.mockResolvedValueOnce({ uri: 'file:///one.wav', totalSeconds: 1, endSeconds: 1 });
  await expect(
    transcribeVideoAudio('file:///quiet.mp4', new AbortController().signal),
  ).resolves.toMatchObject({
    status: 'no-speech',
    levels: { rmsDbfs: -96, quietWindowPercent: 100 },
  });
  expect(mockRecognize).not.toHaveBeenCalled();
});
test('preserves partial results and distinguishes failures from no audio', async () => {
  mockDecode
    .mockResolvedValueOnce({ uri: 'file:///one.wav', totalSeconds: 2, endSeconds: 1 })
    .mockRejectedValueOnce(new Error('Codec failed'));
  await expect(
    transcribeVideoAudio('file:///clip.mp4', new AbortController().signal),
  ).resolves.toMatchObject({
    status: 'partial',
    processedSeconds: 1,
    segments: [{ text: 'Narration from the reel.' }],
  });
  mockDecode.mockRejectedValueOnce(new Error('Codec failed'));
  await expect(
    transcribeVideoAudio('file:///bad.mp4', new AbortController().signal),
  ).resolves.toMatchObject({ status: 'failed' });
});
test('cancellation releases the recognizer and temporary window', async () => {
  const controller = new AbortController();
  mockDecode.mockResolvedValueOnce({ uri: 'file:///one.wav', totalSeconds: 1, endSeconds: 1 });
  mockRecognize.mockImplementationOnce(async () => {
    controller.abort();
    throw new Error('Aborted');
  });
  await expect(transcribeVideoAudio('file:///clip.mp4', controller.signal)).rejects.toBeDefined();
  expect(mockRelease).toHaveBeenCalledTimes(1);
  expect(mockDelete).toHaveBeenCalledTimes(1);
});
test('queued cancellation cannot strand the shared speech/decoder lock', async () => {
  const unlock = await acquireAsrWork(new AbortController().signal),
    controller = new AbortController();
  const waiting = acquireAsrWork(controller.signal);
  controller.abort();
  await expect(waiting).rejects.toBeDefined();
  unlock();
  const next = await acquireAsrWork(new AbortController().signal);
  next();
});
test('PCM analysis detects clipping and rejects malformed or stereo waves', () => {
  const bytes = pcm();
  const d = new DataView(bytes.buffer);
  for (let i = 44; i < bytes.length; i += 2) d.setInt16(i, -32768, true);
  expect(audioLevels(measurePcmWave(bytes))).toMatchObject({
    rmsDbfs: 0,
    peakDbfs: 0,
    clippedSamplePercent: 100,
  });
  d.setUint16(22, 2, true);
  expect(() => measurePcmWave(bytes)).toThrow();
  expect(() => measurePcmWave(new Uint8Array(20))).toThrow();
});
