import ChevronRightIcon from '@cherrystudio/app-icons/icons/chevron-right';
import PlusIcon from '@cherrystudio/app-icons/icons/plus';
import { BackgroundPressExclusion, Button } from '@cherrystudio/ui/components';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import {
  ConversationSourceBoundary,
  useConversationSessions,
} from '@/frontend/appShell/conversation';
import { useOpenProviderSetup } from '@/frontend/appShell/navigation';
import { conversationHref } from '@/frontend/appShell/navigation/chat';
import { AgentAvatar } from '@/frontend/components/Avatar';
import { type ModelTypeFilter, useModelPickerData } from '@/frontend/components/ModelPicker';
import { useModelChoice } from '@/frontend/components/Policy';
import { capabilityPolicy } from '@/shared/data/managedPolicy';
import type { UniqueModelId } from '@/shared/data/types/model';

import { ChatComposerClearance } from './ChatComposerClearance';

export type ChatDraftModelSetup = {
  modelId: UniqueModelId | null;
  modelType: ModelTypeFilter;
  returnTo: string;
};

type ChatDraftAvatarProps = {
  assistantAvatar?: null | string;
  assistantAvatarUri?: null | string;
  assistantEmoji?: string;
  assistantName?: string;
};

type ChatDraftStateProps = ChatDraftAvatarProps & {
  contentBottomInset: number;
  modelSetup?: ChatDraftModelSetup;
};

/** Conversation state before the first message is sent. */
export function ChatDraftState({
  assistantAvatar,
  assistantAvatarUri,
  assistantEmoji,
  assistantName,
  contentBottomInset,
  modelSetup,
}: ChatDraftStateProps) {
  const avatarProps: ChatDraftAvatarProps = {
    assistantAvatar,
    assistantAvatarUri,
    assistantEmoji,
    assistantName,
  };

  return (
    <ChatComposerClearance
      className={
        modelSetup
          ? 'flex-1 justify-center bg-slate-paper px-6'
          : 'flex-1 items-center justify-center px-6'
      }
      contentBottomInset={contentBottomInset}
    >
      {modelSetup ? (
        <LocalDraftContent {...modelSetup} {...avatarProps} />
      ) : (
        <DraftGreeting {...avatarProps} />
      )}
    </ChatComposerClearance>
  );
}

function DraftGreeting({
  assistantAvatar,
  assistantAvatarUri,
  assistantEmoji,
  assistantName,
}: ChatDraftAvatarProps) {
  const { t } = useTranslation();

  return (
    <View className="w-full max-w-xs items-center gap-6">
      {assistantName ? (
        <AgentAvatar
          avatar={assistantAvatar}
          emoji={assistantEmoji}
          name={assistantName}
          size={48}
          uri={assistantAvatarUri}
        />
      ) : null}
      <Text className="text-center font-medium text-foreground text-xl" numberOfLines={2}>
        {t('chat.draft.greeting')}
      </Text>
    </View>
  );
}

function LocalDraftContent({
  modelId,
  modelType,
  returnTo,
}: ChatDraftModelSetup & ChatDraftAvatarProps) {
  const { t } = useTranslation();
  const { allowedModelIds } = useModelChoice();
  const { getModelItem, hasLoadedCatalog, modelItems } = useModelPickerData({ modelType });
  const openProviderSetup = useOpenProviderSetup(returnTo);

  // A managed Agent takes its model choices from the organization.
  const hasAvailableModel = Boolean(
    allowedModelIds || !hasLoadedCatalog || modelItems.length > 0 || getModelItem(modelId),
  );
  const canAddProvider = capabilityPolicy('providerSettings').canEdit('providerSettings');

  return (
    <EditorialGreeting>
      {!hasAvailableModel &&
        (canAddProvider ? (
          <BackgroundPressExclusion>
            <View className="items-start">
              <Button
                haptic="light"
                icon={<PlusIcon />}
                onPress={openProviderSetup}
                shape="pill"
                size="sm"
                testID="chat-draft-add-provider"
                variant="tonal"
              >
                {t('modelPicker.addProvider')}
              </Button>
            </View>
          </BackgroundPressExclusion>
        ) : (
          <Text className="text-base text-muted-foreground">
            {t('chat.draft.noAvailableModel')}
          </Text>
        ))}
    </EditorialGreeting>
  );
}

const editorialTitle = {
  fontFamily: 'PlayfairDisplay-Bold',
  fontSize: 44,
  lineHeight: 48,
  letterSpacing: -1.65,
  includeFontPadding: false,
};

function EditorialGreeting({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  return (
    <View className="w-full max-w-lg self-center gap-5">
      <Text
        accessibilityRole="header"
        className="max-w-[320px] text-foreground"
        testID="slate-editorial-title"
        style={editorialTitle}
      >
        {t('slate.editorial.greeting')}
      </Text>
      {children}
      <ConversationSourceBoundary source={{ kind: 'local' }} fallback={() => null}>
        <EditorialRecents />
      </ConversationSourceBoundary>
    </View>
  );
}

function EditorialRecents() {
  const { t } = useTranslation();
  const router = useRouter();
  const { items } = useConversationSessions();
  if (items.length === 0) return null;

  return (
    <BackgroundPressExclusion>
      <View className="border-t border-border pt-3">
        <Text className="pb-1 text-sm font-medium text-muted-foreground">
          {t('session.search.recent')}
        </Text>
        {items.slice(0, 2).map((item) => (
          <Pressable
            accessibilityRole="button"
            className="min-h-12 flex-row items-center gap-3 border-b border-border py-2 active:opacity-60"
            key={item.ref.sessionId}
            onPress={() => router.replace(conversationHref(item.ref))}
          >
            <Text className="flex-1 text-base text-foreground" numberOfLines={1}>
              {item.title || t('chat.newSession.title')}
            </Text>
            <ChevronRightIcon className="size-4 text-muted-foreground" />
          </Pressable>
        ))}
      </View>
    </BackgroundPressExclusion>
  );
}
