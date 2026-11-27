import { useToast } from '@cherrystudio/ui/components';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';

import { usePrivacyConsent } from '@/frontend/appShell/privacy';

import { OnboardingButton, OnboardingPage } from '../components/OnboardingPage';
import type { OnboardingProgress } from './useOnboardingProgress';

export function IntroOnboardingStep({ progress }: { progress: OnboardingProgress }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const privacy = usePrivacyConsent();
  const welcome = progress.status === 'welcome' || progress.status === 'unseen';
  const busy = progress.isSaving || privacy.isSaving;
  const continueAfterConsent = async () => {
    if (busy) return;
    const saved = await privacy.decline();
    if (saved) await progress.advance('permissions');
    else toast.show({ label: t('privacyConsent.saveFailed'), variant: 'danger' });
  };
  return (
    <OnboardingPage
      description={t(welcome ? 'onboarding.intro.description' : 'onboarding.privacy.description')}
      footer={
        <OnboardingButton
          loading={busy}
          onPress={() => void (welcome ? progress.advance('privacy') : continueAfterConsent())}
          testID={welcome ? 'onboarding-start' : 'onboarding-privacy-continue'}
        >
          {t(welcome ? 'onboarding.intro.start' : 'onboarding.continue')}
        </OnboardingButton>
      }
      onBack={welcome || busy ? undefined : () => void progress.advance('welcome')}
      step={
        welcome
          ? undefined
          : { current: 1, total: 3, label: t('onboarding.preparation.step', { current: 1 }) }
      }
      testID={welcome ? 'onboarding-welcome' : 'onboarding-privacy'}
      title={t(welcome ? 'onboarding.welcome.title' : 'slate.privacy.title')}
      variant={welcome ? 'welcome' : 'step'}
    >
      {!welcome ? (
        <View className="gap-8">
          <Text className="text-muted-foreground text-base leading-7">
            {t('slate.privacy.description')}
          </Text>
        </View>
      ) : null}
    </OnboardingPage>
  );
}
