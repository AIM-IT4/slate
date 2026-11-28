import FileTextIcon from '@cherrystudio/app-icons/icons/file-text';
import ImageIcon from '@cherrystudio/app-icons/icons/image';
import { Button, ContentState, Dialog, Image } from '@cherrystudio/ui/components';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, useWindowDimensions, View } from 'react-native';

import { inlineArtifactKind } from '@/frontend/utils/inlineArtifacts';

import { InlineHtmlPreview } from './InlineHtmlPreview';
import { InlineMediaPreview } from './InlineMediaPreview';
import { usePreviewActive } from './usePreviewActive';

export type InlineArtifactSource =
  | { kind: 'html'; html: string }
  | { kind: 'remote'; uri: string; mediaType?: string }
  | { kind: 'managed-media'; uri: string; mediaType: string }
  | { kind: 'embedded-audio'; data: string; mediaType: string };

export function InlineArtifact({ source, name }: { source: InlineArtifactSource; name?: string }) {
  const { t } = useTranslation();
  const { height } = useWindowDimensions();
  const active = usePreviewActive();
  const [expanded, setExpanded] = useState(false);
  const [failed, setFailed] = useState(false);
  const title = name || t('slate.preview.title');
  const kind =
    source.kind === 'html'
      ? 'html'
      : source.kind === 'remote'
        ? inlineArtifactKind(source.uri, source.mediaType)
        : source.kind === 'embedded-audio'
          ? 'audio'
          : source.mediaType.startsWith('video/')
            ? 'video'
            : 'audio';
  if (!kind || !active) return null;
  const content = () => {
    if (failed)
      return (
        <ContentState.Error
          title={t('fileViewer.previewFailed')}
          primaryAction={{ children: t('common.retry'), onPress: () => setFailed(false) }}
        />
      );
    if (source.kind === 'html')
      return <InlineHtmlPreview source={{ html: source.html }} onFailure={() => setFailed(true)} />;
    if (kind === 'html' && source.kind === 'remote')
      return <InlineHtmlPreview source={{ uri: source.uri }} onFailure={() => setFailed(true)} />;
    if (kind === 'image' && source.kind === 'remote')
      return <Image source={source.uri} contentFit="contain" className="h-72 w-full" />;
    if (kind === 'video' || kind === 'audio') {
      if (source.kind === 'embedded-audio') {
        if (
          source.data.length > 12 * 1024 * 1024 ||
          !/^audio\/[a-z0-9.+-]+$/i.test(source.mediaType) ||
          !/^[A-Za-z0-9+/=\s]+$/.test(source.data)
        )
          return null;
        return (
          <InlineMediaPreview
            source={{
              kind: 'embedded-audio',
              uri: `data:${source.mediaType};base64,${source.data}`,
            }}
            media="audio"
            onFailure={() => setFailed(true)}
          />
        );
      }
      if (source.kind === 'remote' || source.kind === 'managed-media')
        return (
          <InlineMediaPreview
            source={{ kind: source.kind === 'remote' ? 'remote' : 'managed', uri: source.uri }}
            media={kind}
            onFailure={() => setFailed(true)}
          />
        );
    }
    return null;
  };
  const preview = () =>
    kind === 'html' ? (
      <View
        style={{ height: expanded ? Math.max(320, height * 0.65) : 360 }}
        className="overflow-hidden rounded-lg bg-secondary"
      >
        {content()}
      </View>
    ) : (
      content()
    );
  return (
    <View className="w-full overflow-hidden rounded-2xl border border-border bg-card" testID="artifact-inline-preview">
      <View className="flex-row items-center gap-2 border-b border-border-subtle px-3 py-2">
        <View className="size-9 items-center justify-center rounded-xl bg-primary/10">
          {kind === 'image' || kind === 'video' ? <ImageIcon className="size-5 text-primary" /> : <FileTextIcon className="size-5 text-primary" />}
        </View>
        <View className="min-w-0 flex-1">
          <Text className="text-sm font-semibold text-foreground" numberOfLines={1}>{title}</Text>
          <Text className="text-xs text-muted-foreground" numberOfLines={1}>{kind.toUpperCase()} · {t('slate.preview.title')}</Text>
        </View>
        {kind === 'html' ? (
          <Button
            size="inline"
            variant="link"
            onPress={() => setExpanded(true)}
            accessibilityLabel={t('slate.preview.expand')}
            testID="artifact-inline-expand"
          >
            <Button.Label>{t('slate.preview.expand')}</Button.Label>
          </Button>
        ) : null}
      </View>
      {!expanded ? <View className="overflow-hidden bg-background">{preview()}</View> : <View className="h-12" />}
      {expanded ? (
        <Dialog open onOpenChange={setExpanded} title={title}>
          {preview()}
          <Button onPress={() => setExpanded(false)}>
            <Button.Label>{t('common.close')}</Button.Label>
          </Button>
        </Dialog>
      ) : null}
    </View>
  );
}
