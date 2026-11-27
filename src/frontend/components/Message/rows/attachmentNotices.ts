import type { TFunction } from 'i18next';

import type { UserMessageAttachmentPart } from './partitionUserMessageParts';

const VIDEO_AUDIO_NOTICE_KEYS = {
  transcribed: 'attachments.video.audio.transcribed',
  partial: 'attachments.video.audio.partial',
  'no-speech': 'attachments.video.audio.no-speech',
  'no-audio': 'attachments.video.audio.no-audio',
  failed: 'attachments.video.audio.failed',
  unsupported: 'attachments.video.audio.unsupported',
} as const;

/** Delivery mode and content limitations for each sent attachment, in attachment order. */
export function attachmentNotices(
  attachments: readonly UserMessageAttachmentPart[],
  t: TFunction,
): { key: string; text: string; tone: 'neutral' | 'warning' }[] {
  const named = attachments.length > 1;
  return attachments.flatMap(({ index, part, report }) => {
    if (!report) return [];
    const notices = [
      ...(report.mode === 'video'
        ? [
            {
              kind: report.audio?.status === 'transcribed' ? 'videoComplete' : 'video',
              text: t(
                report.audio
                  ? VIDEO_AUDIO_NOTICE_KEYS[report.audio.status]
                  : 'attachments.video.sampled',
                {
                  count: report.images?.sent ?? 0,
                  seconds: Math.round(report.audio?.processedSeconds ?? 0),
                },
              ),
            },
          ]
        : []),
      ...(report.mode === 'image-text'
        ? [{ kind: 'imageText', text: t('attachments.notice.imageText') }]
        : []),
      ...(report.unrecognizedPages?.length
        ? [
            {
              kind: 'unrecognizedPages',
              text: t('attachments.notice.unrecognizedPages', {
                pages: report.unrecognizedPages.join(t('attachments.notice.pageSeparator')),
              }),
            },
          ]
        : []),
      ...(report.sourceTruncated && report.mode !== 'video'
        ? [{ kind: 'sourceTruncated', text: t('attachments.notice.sourceTruncated') }]
        : []),
      ...(report.requestTruncated
        ? [{ kind: 'requestTruncated', text: t('attachments.notice.requestTruncated') }]
        : []),
    ];
    // Keyed by message part position: same-named attachments can produce identical text.
    return notices.map(({ kind, text }) => ({
      key: `${index}:${kind}`,
      tone: kind === 'imageText' || kind === 'videoComplete' ? 'neutral' : 'warning',
      text: named
        ? t('attachments.notice.withFilename', { name: part.filename, notice: text })
        : text,
    }));
  });
}
