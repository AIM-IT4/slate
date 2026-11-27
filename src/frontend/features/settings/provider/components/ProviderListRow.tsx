import ChevronRightIcon from '@cherrystudio/app-icons/icons/chevron-right';
import { Section, Sortable, Spinner, Switch } from '@cherrystudio/ui/components';
import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { type AccessibilityProps, Text, View, type ViewProps } from 'react-native';

import { ProviderAvatar } from '@/frontend/components/Avatar';
import type { Provider } from '@/shared/data/types/provider';

export const ProviderListRow = memo(function ProviderListRow({
  accessibilityActions,
  isEnabled,
  isPending,
  onAccessibilityAction,
  onOpen,
  onToggle,
  provider,
}: {
  accessibilityActions?: AccessibilityProps['accessibilityActions'];
  isEnabled: boolean;
  isPending: boolean;
  onAccessibilityAction?: ViewProps['onAccessibilityAction'];
  onOpen: (provider: Provider) => void;
  onToggle: (provider: Provider, isEnabled: boolean) => void;
  provider: Provider;
}) {
  const { t } = useTranslation();
  const statusLabel = t(
    isEnabled ? 'settings.provider.status.enabled' : 'settings.provider.status.disabled',
  );

  return (
    <Section.Item
      accessibilityActions={accessibilityActions}
      accessibilityLabel={[provider.name, statusLabel].filter(Boolean).join(', ')}
      accessibilityState={{ busy: isPending }}
      label={
        <View className="min-w-0 flex-row items-center gap-2">
          <Text className="min-w-0 shrink text-base text-foreground" numberOfLines={1}>
            {provider.name}
          </Text>
        </View>
      }
      // Opening the details only reads them, so the row stays live inside a locked group.
      locked={false}
      leading={
        <ProviderAvatar
          presetProviderId={provider.presetProviderId}
          providerId={provider.id}
          providerName={provider.name}
        />
      }
      onAccessibilityAction={onAccessibilityAction}
      onPress={() => {
        if (!isPending) onOpen(provider);
      }}
      showChevron={false}
      testID={`provider-row-${provider.id}`}
      trailing={
        <View className="flex-row items-center gap-2">
          <Sortable.Exclusion>
            <Switch
              accessibilityLabel={t(
                isEnabled
                  ? 'settings.provider.disableProviderNamed'
                  : 'settings.provider.enableProviderNamed',
                { name: provider.name },
              )}
              disabled={isPending}
              onValueChange={(value) => onToggle(provider, value)}
              testID={`provider-enabled-switch-${provider.id}`}
              value={isEnabled}
            />
          </Sortable.Exclusion>
          <View className="size-5 items-center justify-center">
            {isPending ? (
              <Spinner accessibilityLabel={t('settings.provider.status.updating')} size="sm" />
            ) : (
              <ChevronRightIcon className="size-5 text-muted-foreground" />
            )}
          </View>
        </View>
      }
    />
  );
});
