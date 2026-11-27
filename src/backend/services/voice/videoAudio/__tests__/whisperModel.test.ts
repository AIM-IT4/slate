import { ASR } from '@siteed/sherpa-onnx.rn';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform, TurboModuleRegistry } from 'react-native';

import { hashLocalFile } from '@/backend/services/file/fileHash';

import models from '../modelAssets.json';
import { openVideoWhisper } from '../whisperModel';

jest.mock('@siteed/sherpa-onnx.rn', () => ({
  ASR: {
    initialize: jest.fn(),
    recognizeFromSamples: jest.fn(),
    // Android MediaCodec has no audio/raw decoder. The old WAV path fails here.
    recognizeFromFile: jest.fn(async () => {
      throw new Error('No decoder for audio/raw');
    }),
    release: jest.fn(),
  },
}));
jest.mock('expo-file-system/legacy', () => ({
  makeDirectoryAsync: jest.fn(),
  getInfoAsync: jest.fn(),
  copyAsync: jest.fn(),
  deleteAsync: jest.fn(),
  moveAsync: jest.fn(),
}));
jest.mock('@/backend/services/file/fileHash', () => ({ hashLocalFile: jest.fn() }));
jest.mock('../../../../../../modules/voice-input', () => ({
  getVoiceInput: () => ({
    decodeAudioChunk: jest.fn(),
    modelDirectory: async () => 'file:///private/VoiceModels/',
  }),
}));

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, 'OS', 'android');
  jest.spyOn(TurboModuleRegistry, 'get').mockReturnValue({});
  jest.mocked(FileSystem.getInfoAsync).mockImplementation(async (uri) => {
    const asset = models.files.find((file) => uri.endsWith(file.name))!;
    return { exists: true, isDirectory: false, size: asset.bytes, uri, modificationTime: 0 };
  });
  jest
    .mocked(hashLocalFile)
    .mockImplementation(
      async (uri) => models.files.find((file) => uri.endsWith(file.name))!.sha256,
    );
  jest.mocked(ASR.initialize).mockResolvedValue({ success: true });
  jest
    .mocked(ASR.recognizeFromSamples)
    .mockResolvedValue({ success: true, text: ' Narration from video. ' });
  jest.mocked(ASR.release).mockResolvedValue({ released: true });
});
afterEach(() => jest.restoreAllMocks());

test('recognizes decoded PCM without sending its WAV back through the compressed-file decoder', async () => {
  const recognizer = await openVideoWhisper(new AbortController().signal);
  const pcm = { sampleRate: 16000, samples: [-1, 0, 0.5] };
  await expect(recognizer.recognize(pcm)).resolves.toBe('Narration from video.');
  expect(ASR.recognizeFromSamples).toHaveBeenCalledWith(16000, pcm.samples);
  expect(ASR.recognizeFromFile).not.toHaveBeenCalled();
  await recognizer.release();
  await recognizer.release();
  expect(ASR.release).toHaveBeenCalledTimes(1);
});

test('native recognition failure stays a failure and the next clip can start a fresh recognizer', async () => {
  const first = await openVideoWhisper(new AbortController().signal);
  jest.mocked(ASR.recognizeFromSamples).mockResolvedValueOnce({ success: false });
  await expect(first.recognize({ sampleRate: 16000, samples: [0] })).rejects.toThrow();
  await first.release();
  const next = await openVideoWhisper(new AbortController().signal);
  await expect(next.recognize({ sampleRate: 16000, samples: [0.5] })).resolves.toBe(
    'Narration from video.',
  );
  await next.release();
  expect(ASR.release).toHaveBeenCalledTimes(2);
});
