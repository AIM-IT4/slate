import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { SettingsScrollPage } from '../components/SettingsScrollPage';

export default function PrivacySettingsScreen() {
  const { t } = useTranslation();
  return (
    <SettingsScrollPage headerProps={{ title: t('settings.privacy.title') }}>
      <View className="gap-4 px-2 py-4">
        <Text className="text-foreground text-2xl font-semibold">{t('slate.privacy.title')}</Text>
        <Text className="text-muted-foreground text-base leading-7">
          {t('slate.privacy.description')}
        </Text>
      </View>
    </SettingsScrollPage>
  );
}
