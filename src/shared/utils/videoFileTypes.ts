import { FALLBACK_MEDIA_TYPE, filenameExtension } from '@/shared/data/types/file';

export const MAX_VIDEO_ATTACHMENT_BYTES = 512 * 1024 * 1024;
export const MAX_VIDEO_FRAMES = 12;

export function isVideoMediaType(mediaType: string): boolean {
  return mediaType.toLowerCase().startsWith('video/');
}

const videoTypes = new Map([
  ['mp4', 'video/mp4'],
  ['m4v', 'video/mp4'],
  ['mov', 'video/quicktime'],
  ['webm', 'video/webm'],
  ['mkv', 'video/x-matroska'],
  ['avi', 'video/x-msvideo'],
  ['mpeg', 'video/mpeg'],
  ['mpg', 'video/mpeg'],
  ['3gp', 'video/3gpp'],
]);
export function resolveVideoImportMediaType(name: string, mediaType?: string): string {
  if (mediaType && mediaType.toLowerCase() !== FALLBACK_MEDIA_TYPE) return mediaType;
  return videoTypes.get(filenameExtension(name) ?? '') ?? mediaType ?? FALLBACK_MEDIA_TYPE;
}
