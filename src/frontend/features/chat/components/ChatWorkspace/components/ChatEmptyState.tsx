import { duration } from '@cherrystudio/ui/motion';
import { useTranslation } from 'react-i18next';
import { Text } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

const entrance = FadeInDown.duration(duration.slow).reduceMotion(ReduceMotion.System);

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
      <Animated.View entering={entrance} className="items-center gap-4">
        <Text className="text-center font-semibold text-foreground text-3xl">
          {t('chat.newSession.title')}
        </Text>
        <Text className="text-center text-muted-foreground text-base" numberOfLines={3}>
          {t('chat.newSession.description')}
        </Text>
      </Animated.View>
    </ChatComposerClearance>
  );
}
