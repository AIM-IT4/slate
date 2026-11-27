import { File } from 'expo-file-system';
import {
  createUploadTask,
  FileSystemUploadType,
  FileSystemSessionType,
} from 'expo-file-system/legacy';
import * as z from 'zod';

import { mcpServerService } from '@/backend/data/services/McpServerService';
import { transcribeVideoAudio } from '@/backend/services/voice/videoAudio';
import {
  FileAttachmentError,
  type FileAttachmentContent,
  type FileAttachmentFact,
} from '@/shared/contracts/fileAttachment';
import { isSlateExecutionEndpoint } from '@/shared/utils/slateExecution';
import { MAX_VIDEO_ATTACHMENT_BYTES, MAX_VIDEO_FRAMES } from '@/shared/utils/videoFileTypes';

const videoResponse = z.object({
  durationSeconds: z.number().positive().max(86400),
  workspacePath: z.string().regex(/^uploads\/[a-f0-9]{32}\/source\.video$/),
  frames: z
    .array(
      z.object({
        timestampSeconds: z.number().nonnegative().max(86400),
        data: z
          .string()
          .min(4)
          .max(1024 * 1024)
          .regex(/^[A-Za-z0-9+/]+={0,2}$/),
      }),
    )
    .min(1)
    .max(MAX_VIDEO_FRAMES),
});
type VideoContent = Extract<FileAttachmentContent, { kind: 'video' }>;
const cache = new Map<string, VideoContent>();

/** Upload only to the user's enabled, fixed-origin execution connection. Credentials stay in headers. */
export async function readVideoUriContent(
  uri: string,
  fact: FileAttachmentFact,
  signal: AbortSignal,
  maxFrames: number,
): Promise<VideoContent> {
  const issue = { fileEntryId: fact.fileEntryId, name: fact.name };
  signal.throwIfAborted();
  const servers = await mcpServerService.list({ isEnabled: true });
  const server = servers.items.find(
    (item) =>
      isSlateExecutionEndpoint(item.endpointUrl ?? undefined) &&
      Object.entries(item.headers ?? {}).some(
        ([key, value]) => key.toLowerCase() === 'authorization' && value.startsWith('Bearer '),
      ),
  );
  if (!server) throw new FileAttachmentError({ ...issue, code: 'video-service-unavailable' });
  const key = `${fact.fileEntryId}:${fact.revision}:${fact.size}:${maxFrames}`;
  if (cache.has(key)) return cache.get(key)!;
  let upload: ReturnType<typeof createUploadTask> | undefined;
  const abort = () => {
    void upload?.cancelAsync().catch(() => undefined);
  };
  signal.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 180_000);
  try {
    signal.throwIfAborted();
    const file = new File(uri);
    if (!file.exists || file.size !== fact.size || file.size > MAX_VIDEO_ATTACHMENT_BYTES)
      throw new Error('Video file changed');
    const authorization = Object.entries(server.headers ?? {}).find(
      ([key]) => key.toLowerCase() === 'authorization',
    )![1];
    const endpoint = new URL('/video/prepare', server.endpointUrl!);
    endpoint.searchParams.set(
      'frames',
      String(Math.max(1, Math.min(MAX_VIDEO_FRAMES, Math.floor(maxFrames)))),
    );
    upload = createUploadTask(endpoint.href, uri, {
      httpMethod: 'POST',
      uploadType: FileSystemUploadType.BINARY_CONTENT,
      sessionType: FileSystemSessionType.FOREGROUND,
      headers: {
        Authorization: authorization,
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(file.size),
      },
    });
    signal.throwIfAborted();
    const response = await upload.uploadAsync();
    if (!response || response.status !== 200) throw new Error('Video service rejected upload');
    const parsed = videoResponse.parse(JSON.parse(response.body));
    signal.throwIfAborted();
    if (
      parsed.frames.length > maxFrames ||
      parsed.frames.some((frame) => frame.timestampSeconds > parsed.durationSeconds)
    )
      throw new Error('Invalid video samples');
    clearTimeout(timeout);
    const audio = await transcribeVideoAudio(uri, signal);
    const result: VideoContent = {
      audio,
      kind: 'video',
      durationSeconds: parsed.durationSeconds,
      workspacePath: parsed.workspacePath,
      frames: parsed.frames.map((frame) => ({
        timestampSeconds: frame.timestampSeconds,
        uri: `data:image/jpeg;base64,${frame.data}`,
      })),
    };
    if (cache.size >= 2) cache.delete(cache.keys().next().value!);
    cache.set(key, result);
    return result;
  } catch {
    signal.throwIfAborted();
    throw new FileAttachmentError({ ...issue, code: 'video-processing-failed' });
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}
