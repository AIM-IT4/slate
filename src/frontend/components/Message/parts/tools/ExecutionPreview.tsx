import { BackgroundPressExclusion, ContextMenuExclusion, Image } from '@cherrystudio/ui/components';
import type { NormalizedMcpResult } from '@cherrystudio/universal/ai/tools/mcpResult';
import { Text, View } from 'react-native';

import { InlineArtifact } from '@/frontend/components/InlineArtifact';
import { inlineArtifactKind } from '@/frontend/utils/inlineArtifacts';

import { SourceLink } from '../SourceLink';

/** Explicit artifacts from any MCP server; literal command logs stay scoped to execution. */
export function ExecutionPreview({
  result,
  mode,
}: {
  result: NormalizedMcpResult;
  mode: 'execution' | 'artifacts';
}) {
  const previews = result.content
    .slice(0, 12)
    .map((content, index) => {
      if (content.kind === 'image') {
        return (
          <Image
            key={index}
            source={`data:${content.mimeType};base64,${content.data}`}
            className="h-64 w-full rounded-md"
            contentFit="contain"
          />
        );
      }
      if (content.kind === 'audio' && content.data) {
        return (
          <InlineArtifact
            key={index}
            source={{ kind: 'embedded-audio', data: content.data, mediaType: content.mimeType }}
          />
        );
      }
      if (
        content.kind === 'resource' &&
        content.mimeType.split(';')[0]?.trim().toLowerCase() === 'text/html' &&
        content.text &&
        content.text.length <= 1024 * 1024
      ) {
        return <InlineArtifact key={index} source={{ kind: 'html', html: content.text }} />;
      }
      if (content.kind === 'resource-link' && inlineArtifactKind(content.uri, content.mimeType)) {
        return (
          <View key={content.uri} className="gap-2">
            <InlineArtifact
              source={{ kind: 'remote', uri: content.uri, mediaType: content.mimeType }}
            />
            <SourceLink
              label={content.uri.split('?')[0].split('/').pop() || content.uri}
              url={content.uri}
              variant="listItem"
            />
          </View>
        );
      }
      if (mode !== 'execution') return null;
      if (content.kind === 'resource-link' && /^https:\/\//i.test(content.uri)) {
        return (
          <SourceLink
            key={content.uri}
            label={content.uri.split('?')[0].split('/').pop() || content.uri}
            url={content.uri}
            variant="listItem"
          />
        );
      }
      if (content.kind !== 'text') return null;
      let value = content.text;
      try {
        const output = JSON.parse(value);
        if (typeof output.stdout === 'string' && typeof output.stderr === 'string') {
          value = [
            output.stdout,
            output.stderr,
            typeof output.exit_code === 'number' ? `exit ${output.exit_code}` : output.state,
          ]
            .filter(Boolean)
            .join('\n');
        }
      } catch {
        /* A plain tool error remains literal text. */
      }
      return (
        <Text key={index} selectable className="font-mono text-sm text-foreground">
          {value.slice(-6000)}
        </Text>
      );
    })
    .filter(Boolean);
  if (!previews.length) return null;
  return (
    <BackgroundPressExclusion>
      <ContextMenuExclusion className="w-full">
        <View className="gap-3 py-2" testID="execution-inline-output">
          {previews}
        </View>
      </ContextMenuExclusion>
    </BackgroundPressExclusion>
  );
}
