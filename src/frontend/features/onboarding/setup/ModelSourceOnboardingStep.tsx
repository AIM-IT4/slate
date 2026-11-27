import { Redirect, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { View } from 'react-native';

import { useQuery } from '@/frontend/data';

import {
  OnboardingButton,
  OnboardingMessage,
  OnboardingOption,
  OnboardingPage,
} from '../components/OnboardingPage';
import { getOnboardingDestination } from './onboardingDestination';
import type { OnboardingProgress } from './useOnboardingProgress';

export function ModelSourceOnboardingStep({ progress }: { progress: OnboardingProgress }) {
  const { t } = useTranslation();
  const router = useRouter();
  const models = useQuery('/models', {
    query: { enabled: true, isSystemSupported: true },
    retry: false,
  });
  const destination = getOnboardingDestination({
    hasModels: (models.data?.length ?? 0) > 0,
    isLoading: models.isPending || models.isRefreshing,
    isError: models.isError,
  });
  if (!progress.isSaving && destination === 'model') return <Redirect href="/onboarding/model" />;

  return (
    <OnboardingPage
      description={t('onboarding.welcome.description')}
      footer={
        <>
          {destination === 'retry' ? (
            <OnboardingButton disabled={progress.isSaving} onPress={() => void models.refetch()}>
              {t('common.retry')}
            </OnboardingButton>
          ) : null}
          <OnboardingButton
            loading={progress.isSaving}
            onPress={() => void progress.skip()}
            testID="onboarding-model-source-skip"
            variant="text"
          >
            {t('onboarding.skip')}
          </OnboardingButton>
        </>
      }
      testID="onboarding-model-source"
      title={t('onboarding.source.title')}
    >
      {destination === 'loading' ? (
        <OnboardingMessage loading>{t('onboarding.loading')}</OnboardingMessage>
      ) : destination === 'retry' ? (
        <OnboardingMessage>{t('settings.provider.models.management.loadFailed')}</OnboardingMessage>
      ) : (
        <View className="gap-4">
          <OnboardingOption
            description={t('onboarding.source.providerDescription')}
            disabled={progress.isSaving}
            onPress={() => router.replace('/onboarding/provider')}
            testID="onboarding-connect"
            title={t('onboarding.welcome.connect')}
          />
          <OnboardingOption
            description={t('onboarding.source.desktopDescription')}
            disabled={progress.isSaving}
            onPress={() => router.replace('/onboarding/device-connections')}
            testID="onboarding-desktop-sync"
            title={t('onboarding.welcome.desktopSync')}
          />
        </View>
      )}
    </OnboardingPage>
  );
}
