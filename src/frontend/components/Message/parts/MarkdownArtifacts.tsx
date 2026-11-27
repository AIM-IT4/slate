import { BackgroundPressExclusion, ContextMenuExclusion } from '@cherrystudio/ui/components';
import { View } from 'react-native';

import { InlineArtifact } from '@/frontend/components/InlineArtifact';
import { markdownArtifactLinks } from '@/frontend/utils/markdownArtifactLinks';

/** Wait for the completed answer before creating interactive surfaces. */
export function MarkdownArtifacts({ markdown }: { markdown: string }) {
  const links = markdownArtifactLinks(markdown);
  if (!links.length) return null;
  return (
    <BackgroundPressExclusion>
      <ContextMenuExclusion className="w-full">
        <View className="w-full gap-3 py-2">
          {links.map(({ uri, name }) => (
            <InlineArtifact key={uri} name={name} source={{ kind: 'remote', uri }} />
          ))}
        </View>
      </ContextMenuExclusion>
    </BackgroundPressExclusion>
  );
}
