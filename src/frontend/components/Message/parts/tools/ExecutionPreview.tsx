import { Image } from '@cherrystudio/ui/components';
import type { NormalizedMcpResult } from '@cherrystudio/universal/ai/tools/mcpResult';
import { Text, View } from 'react-native';

import { SourceLink } from '../SourceLink';

/** Keep literal command output and generated images visible in the conversation. */
export function ExecutionPreview({ result }: { result: NormalizedMcpResult }) {
  return (
    <View className="gap-3 py-2" testID="execution-inline-output">
      {result.content.map((content) => {
        if (content.kind === 'image') {
          return (
            <Image
              key={content.data.slice(-48)}
              source={`data:${content.mimeType};base64,${content.data}`}
              className="h-64 w-full rounded-md"
              contentFit="contain"
            />
          );
        }
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
          // A plain tool error remains literal text.
        }
        return (
          <Text key={content.text} selectable className="font-mono text-sm text-foreground">
            {value.slice(-6000)}
          </Text>
        );
      })}
    </View>
  );
}
