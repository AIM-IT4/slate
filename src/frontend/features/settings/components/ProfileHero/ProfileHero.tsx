import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';

import { ProfileAvatarImage } from '@/frontend/components/Avatar';

type ProfileHeroProps = {
  onPress: () => void;
  userName: string;
};

/** The settings page's local profile entry; it opens the profile. */
export function ProfileHero({ onPress, userName }: ProfileHeroProps) {
  const { t } = useTranslation();
  const displayName = userName.trim() || t('settings.profile.setPrompt');
  return (
    <View className="items-center gap-3 px-6 py-6">
      <Pressable
        accessibilityLabel={t('settings.profile.edit')}
        accessibilityRole="button"
        className="items-center gap-3 active:opacity-80"
        onPress={onPress}
      >
        <ProfileAvatarImage accessibilityLabel={displayName} size={96} />
        <View className="max-w-full items-center gap-1">
          <Text className="text-center font-semibold text-xl text-foreground" numberOfLines={1}>
            {displayName}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
