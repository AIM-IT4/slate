import { ContentState, Image } from '@cherrystudio/ui/components';
import { useQuery } from '@tanstack/react-query';
import { useIsFocused } from 'expo-router';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { FileDocumentPreview, useDocumentPreviewPage } from '@/frontend/components/ArtifactPreview';
import { InlineArtifact } from '@/frontend/components/InlineArtifact';
import { readFileText } from '@/frontend/utils/readFileText';
import type { ResolvedFile } from '@/shared/contracts/file';

import { canPreviewDocument, fileEntryPreviewKind } from './utils/fileEntryPresentation';
import { inlineTextFileContent, isLegacyMcpTextFile } from './utils/inlineTextFile';

export function ManagedInlinePreview({ file }: { file: ResolvedFile }) {
  const focused = useIsFocused();
  const kind = fileEntryPreviewKind(file.entry);
  if (!focused) return null;
  if (kind === 'html' || kind === 'text' || kind === 'markdown')
    return <InlineTextFile file={file} />;
  if (kind === 'audio' || file.entry.mediaType.startsWith('video/'))
    return (
      <InlineArtifact
        name={file.entry.filename}
        source={{ kind: 'managed-media', uri: file.uri, mediaType: file.entry.mediaType }}
      />
    );
  if (canPreviewDocument(file.entry)) return <InlineDocument file={file} />;
  return null;
}

function InlineTextFile({ file }: { file: ResolvedFile }) {
  const query = useQuery({
    queryKey: ['inline-file-text', file.entry.id, file.entry.updatedAt, file.uri],
    queryFn: () =>
      readFileText(
        file.uri,
        isLegacyMcpTextFile(file.entry.filename) ? 5 * 1024 * 1024 : 1024 * 1024,
      ),
    staleTime: Infinity,
    gcTime: 60_000,
    retry: false,
    networkMode: 'always',
  });
  const preview = useMemo(
    () => (query.data ? inlineTextFileContent(file.entry.filename, query.data) : undefined),
    [query.data, file.entry.filename],
  );
  if (!query.data) return null;
  if (fileEntryPreviewKind(file.entry) === 'html') {
    if (query.data.isTruncated) return null;
    return (
      <InlineArtifact name={file.entry.filename} source={{ kind: 'html', html: query.data.text }} />
    );
  }
  if (preview?.kind === 'image')
    return <Image source={preview.uri} contentFit="contain" className="h-72 w-full" />;
  if (preview?.kind === 'audio')
    return (
      <InlineArtifact
        name={file.entry.filename}
        source={{ kind: 'embedded-audio', data: preview.data, mediaType: preview.mediaType }}
      />
    );
  if (preview?.kind !== 'text') return null;
  return (
    <View className="max-h-48 w-full overflow-hidden">
      <Text selectable className="font-mono text-sm text-foreground" numberOfLines={8}>
        {preview.text}
      </Text>
    </View>
  );
}

function InlineDocument({ file }: { file: ResolvedFile }) {
  const { t } = useTranslation();
  const page = useDocumentPreviewPage();
  const [failed, setFailed] = useState(false);
  if (failed || page.isError) return <ContentState.Error title={t('fileViewer.previewFailed')} />;
  return (
    <View
      className="h-96 w-full overflow-hidden rounded-lg bg-secondary"
      testID="artifact-inline-document"
    >
      {page.data ? (
        <FileDocumentPreview
          file={file}
          page={page.data}
          bottomInset={0}
          onDocumentError={() => setFailed(true)}
          onFailure={() => setFailed(true)}
          onTooLarge={() => setFailed(true)}
          onUnsupported={() => setFailed(true)}
        />
      ) : (
        <ContentState.Loading title={t('fileViewer.loading')} />
      )}
    </View>
  );
}
