import { File } from 'expo-file-system';

import type { VideoAudioAnalysis } from '@/shared/contracts/fileAttachment';

import { getVoiceInput } from '../../../../../modules/voice-input';
import { acquireAsrWork } from '../asrWorkLock';
import { audioLevels, emptyPcmMetrics, measurePcmWave } from './pcmMetrics';
import { openVideoWhisper, supportsVideoAudio } from './whisperModel';

/** Native extraction reads the MP4 audio track directly, 30 seconds at a time, without a microphone. */
export async function transcribeVideoAudio(
  uri: string,
  signal: AbortSignal,
): Promise<VideoAudioAnalysis> {
  const result: VideoAudioAnalysis = { status: 'unsupported', processedSeconds: 0, segments: [] };
  if (!supportsVideoAudio()) return result;
  const releaseLock = await acquireAsrWork(signal);
  let recognizer: Awaited<ReturnType<typeof openVideoWhisper>> | undefined;
  const metrics = emptyPcmMetrics();
  let characters = 0;
  try {
    let offset = 0,
      total = Infinity;
    while (offset < total) {
      signal.throwIfAborted();
      let temporary: string | undefined;
      try {
        let decoded;
        try {
          decoded = await getVoiceInput()!.decodeAudioChunk!(uri, offset, 30);
        } catch (error) {
          signal.throwIfAborted();
          if (offset === 0 && /no audio track/i.test(String(error)))
            return { ...result, status: 'no-audio' };
          throw error;
        }
        temporary = decoded.uri;
        total = decoded.totalSeconds;
        if (
          !Number.isFinite(total) ||
          total <= 0 ||
          total > 86400 ||
          !Number.isFinite(decoded.endSeconds) ||
          decoded.endSeconds <= offset ||
          decoded.endSeconds > total ||
          decoded.endSeconds > offset + 30.01
        )
          throw new Error('Invalid audio window');
        const file = new File(decoded.uri);
        if (file.size > 16 * 1024 * 1024) throw new Error('Invalid decoded audio size');
        const window = measurePcmWave(await file.bytes());
        signal.throwIfAborted();
        for (const key of Object.keys(metrics) as (keyof typeof metrics)[]) {
          metrics[key] =
            key === 'peak' ? Math.max(metrics[key], window[key]) : metrics[key] + window[key];
        }
        const levels = audioLevels(window);
        // Skip near-silent windows to reduce spurious speech recognition.
        if (levels.rmsDbfs > -55) {
          recognizer ??= await openVideoWhisper(signal);
          const text = await recognizer.recognize(decoded.uri);
          signal.throwIfAborted();
          if (text) {
            const remaining = 50_000 - characters;
            const included = text.slice(0, remaining);
            result.segments.push({
              startSeconds: offset,
              endSeconds: decoded.endSeconds,
              text: included,
            });
            characters += included.length;
            if (text.length > remaining || characters >= 50_000) {
              result.processedSeconds = decoded.endSeconds;
              result.status = 'partial';
              result.levels = audioLevels(metrics);
              return result;
            }
          }
        }
        offset = decoded.endSeconds;
        result.processedSeconds = offset;
      } finally {
        if (temporary) {
          try {
            const file = new File(temporary);
            if (file.exists) file.delete();
          } catch {
            /* A later decoder sweep removes stale windows. */
          }
        }
      }
    }
    signal.throwIfAborted();
    result.status = result.segments.length ? 'transcribed' : 'no-speech';
    result.levels = audioLevels(metrics);
    return result;
  } catch {
    signal.throwIfAborted();
    return {
      ...result,
      status: result.processedSeconds > 0 ? 'partial' : 'failed',
      ...(metrics.samples ? { levels: audioLevels(metrics) } : {}),
    };
  } finally {
    try {
      await recognizer?.release();
    } catch {
      /* The next ASR initialization resets native state. */
    }
    releaseLock();
  }
}
