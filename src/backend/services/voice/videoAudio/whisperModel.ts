import * as FileSystem from 'expo-file-system/legacy';
import { Platform, TurboModuleRegistry } from 'react-native';

import { hashLocalFile } from '@/backend/services/file/fileHash';

import { getVoiceInput } from '../../../../../modules/voice-input';
import models from './modelAssets.json';

let verified = false;
export function supportsVideoAudio() {
  return (
    Platform.OS === 'android' &&
    !!getVoiceInput()?.decodeAudioChunk &&
    !!TurboModuleRegistry.get('SherpaOnnx')
  );
}
export async function openVideoWhisper(signal: AbortSignal) {
  const native = getVoiceInput();
  if (!native || !supportsVideoAudio()) throw new Error('Video audio unavailable');
  const root = `${(await native.modelDirectory()).replace(/\/$/, '')}/slate-whisper-${models.revision.slice(0, 8)}/`;
  await FileSystem.makeDirectoryAsync(root, { intermediates: true });
  for (const file of models.files) {
    signal.throwIfAborted();
    const target = root + file.name;
    const info = await FileSystem.getInfoAsync(target);
    let valid = info.exists && !info.isDirectory && info.size === file.bytes;
    if (valid && !verified) valid = (await hashLocalFile(target, signal)) === file.sha256;
    if (!valid) {
      const temporary = target + '.part';
      try {
        await FileSystem.copyAsync({ from: `asset:///slate-whisper/${file.name}`, to: temporary });
        signal.throwIfAborted();
        if ((await hashLocalFile(temporary, signal)) !== file.sha256)
          throw new Error('Bundled speech model verification failed');
        await FileSystem.deleteAsync(target, { idempotent: true });
        await FileSystem.moveAsync({ from: temporary, to: target });
      } finally {
        await FileSystem.deleteAsync(temporary, { idempotent: true }).catch(() => undefined);
      }
    }
  }
  verified = true;
  // Loading is optional so incompatible development clients still display sampled video frames.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- share the optional native singleton with dictation
  const sherpa = require('@siteed/sherpa-onnx.rn') as typeof import('@siteed/sherpa-onnx.rn');
  let released = false;
  const release = async () => {
    if (!released) {
      released = true;
      await sherpa.ASR.release();
    }
  };
  try {
    const result = await sherpa.ASR.initialize({
      modelDir: decodeURIComponent(new URL(root).pathname),
      modelType: 'whisper',
      modelFiles: {
        encoder: 'tiny-encoder.int8.onnx',
        decoder: 'tiny-decoder.int8.onnx',
        tokens: 'tiny-tokens.txt',
      },
      numThreads: 2,
      provider: 'cpu',
      streaming: false,
      language: '',
      task: 'transcribe',
    });
    if (!result.success) throw new Error('Speech model initialization failed');
    signal.throwIfAborted();
  } catch (error) {
    await release().catch(() => undefined);
    throw error;
  }
  return {
    async recognize(audio: { sampleRate: number; samples: number[] }) {
      signal.throwIfAborted();
      // The window is already PCM. recognizeFromFile tries MediaCodec for audio/raw on Android.
      const result = await sherpa.ASR.recognizeFromSamples(audio.sampleRate, audio.samples);
      signal.throwIfAborted();
      if (!result.success) throw new Error('Video transcription failed');
      return (result.text ?? '').replace(/<\|[^|]*\|>/g, '').trim();
    },
    release,
  };
}
