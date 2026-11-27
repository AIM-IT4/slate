import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { ChatComposerClearance } from './ChatComposerClearance';

type ChatEmptyStateProps = {
  contentBottomInset: number;
};

/** Empty chat surface shown until the user selects an Agent or opens a Session. */
export function ChatEmptyState({ contentBottomInset }: ChatEmptyStateProps) {
  const { t } = useTranslation();

  return (
    <ChatComposerClearance
      className="flex-1 items-center justify-center px-8"
      contentBottomInset={contentBottomInset}
    >
      <View className="items-center gap-4">
        <Text className="text-center font-semibold text-foreground text-3xl">
          {t('chat.newSession.title')}
        </Text>
        <Text className="text-center text-muted-foreground text-base" numberOfLines={3}>
          {t('chat.newSession.description')}
        </Text>
      </View>
    </ChatComposerClearance>
  );
}
