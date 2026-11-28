import ChevronRightIcon from '@cherrystudio/app-icons/icons/chevron-right';
import PlusIcon from '@cherrystudio/app-icons/icons/plus';
import CodeIcon from '@cherrystudio/app-icons/icons/code';
import FileTextIcon from '@cherrystudio/app-icons/icons/file-text';
import SparklesIcon from '@cherrystudio/app-icons/icons/sparkles';
import MessageCircleIcon from '@cherrystudio/app-icons/icons/message-circle';
import { BackgroundPressExclusion, Button } from '@cherrystudio/ui/components';
import { duration } from '@cherrystudio/ui/motion';
import { useRouter } from 'expo-router';
import type { PropsWithChildren } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInDown, ReduceMotion } from 'react-native-reanimated';

const greetingEntrance = FadeInDown.duration(duration.slow).reduceMotion(ReduceMotion.System);

import {
  ConversationSourceBoundary,
  useConversationSessions,
} from '@/frontend/appShell/conversation';
import { useOpenProviderSetup } from '@/frontend/appShell/navigation';
import { conversationHref } from '@/frontend/appShell/navigation/chat';
import { AgentAvatar } from '@/frontend/components/Avatar';
import { useComposerActions, useComposerPresentationState, useComposerState } from '@/frontend/components/Composer';
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
          ? 'flex-1 justify-center bg-slate-paper px-5'
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
    <Animated.View entering={greetingEntrance} className="w-full max-w-xs items-center gap-6">
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
    </Animated.View>
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
  fontWeight: '600' as const,
  fontSize: 36,
  lineHeight: 42,
  letterSpacing: -1.8,
  includeFontPadding: false,
};

function EditorialGreeting({ children }: PropsWithChildren) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={greetingEntrance} className="w-full max-w-lg self-center gap-4">
      <View className="size-12 items-center justify-center rounded-2xl bg-foreground">
        <SparklesIcon className="size-6 text-background" />
      </View>
      <Text
        accessibilityRole="header"
        className="max-w-[340px] text-foreground"
        testID="slate-editorial-title"
        style={editorialTitle}
      >
        {t('slate.editorial.greeting')}
      </Text>
      {children}
      <QuickPrompts />
      <ConversationSourceBoundary source={{ kind: 'local' }} fallback={() => null}>
        <EditorialRecents />
      </ConversationSourceBoundary>
    </Animated.View>
  );
}

const promptShortcuts = [
  { label: 'Explore an idea', text: 'Help me explore this idea: ', Icon: SparklesIcon },
  { label: 'Write something', text: 'Help me draft: ', Icon: MessageCircleIcon },
  { label: 'Build with code', text: 'Help me build: ', Icon: CodeIcon },
  { label: 'Analyze a file', text: 'Analyze the attached file and summarize the key findings.', Icon: FileTextIcon },
] as const;

function QuickPrompts() {
  const { draft } = useComposerState();
  const { editDraft } = useComposerActions();
  const { isEditing } = useComposerPresentationState();
  if (isEditing || draft.trim()) return null;

  return (
    <BackgroundPressExclusion>
      <View className="flex-row flex-wrap gap-2">
        {promptShortcuts.map(({ label, text, Icon }) => (
          <Pressable
            key={label}
            accessibilityRole="button"
            accessibilityLabel={label}
            className="min-h-16 flex-1 basis-[43%] flex-row items-center gap-2 rounded-2xl border border-border bg-card px-3 py-3 active:opacity-60"
            onPress={() => editDraft(text)}
          >
            <View className="size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Icon className="size-4.5 text-primary" />
            </View>
            <Text className="min-w-0 flex-1 text-sm font-medium text-foreground" numberOfLines={2}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
    </BackgroundPressExclusion>
  );
}

function EditorialRecents() {
  const { t } = useTranslation();
  const router = useRouter();
  const { items } = useConversationSessions();
  const { isEditing } = useComposerPresentationState();
  if (items.length === 0 || isEditing) return null;

  return (
    <BackgroundPressExclusion>
      <View className="gap-2 pt-2">
        <Text className="pb-1 text-xs font-semibold text-muted-foreground">
          {t('session.search.recent')}
        </Text>
        {items.slice(0, 2).map((item) => (
          <Pressable
            accessibilityRole="button"
            className="min-h-11 flex-row items-center gap-3 rounded-xl px-2 py-1 active:opacity-70"
            key={item.ref.sessionId}
            onPress={() => router.replace(conversationHref(item.ref))}
          >
            <Text className="flex-1 text-base text-foreground" numberOfLines={1}>
              {item.title || t('chat.newSession.title')}
            </Text>
            <View className="size-8 items-center justify-center rounded-full bg-secondary">
              <ChevronRightIcon className="size-4 text-muted-foreground" />
            </View>
          </Pressable>
        ))}
      </View>
    </BackgroundPressExclusion>
  );
}
