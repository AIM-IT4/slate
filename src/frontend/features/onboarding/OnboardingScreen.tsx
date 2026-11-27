import { Redirect } from 'expo-router';

import { usePrivacyConsentPending } from '@/frontend/appShell/privacy';

import { IntroOnboardingStep } from './setup/IntroOnboardingStep';
import { ModelSourceOnboardingStep } from './setup/ModelSourceOnboardingStep';
import { NotificationsOnboardingStep } from './setup/NotificationsOnboardingStep';
import { PermissionsOnboardingStep } from './setup/PermissionsOnboardingStep';
import { useOnboardingProgress } from './setup/useOnboardingProgress';

/** Both new installs and legacy account-stage installs continue to provider setup. */
export function OnboardingScreen() {
  const progress = useOnboardingProgress();
  const privacyPending = usePrivacyConsentPending();
  if (progress.status === 'completed' || progress.status === 'skipped')
    return <Redirect href="/" />;
  if (
    progress.status === 'unseen' ||
    progress.status === 'welcome' ||
    progress.status === 'privacy'
  )
    return <IntroOnboardingStep progress={progress} />;
  // A policy change during an interrupted setup is disclosed inline before proceeding.
  if (privacyPending) return <IntroOnboardingStep progress={{ ...progress, status: 'privacy' }} />;
  if (progress.status === 'permissions') return <PermissionsOnboardingStep progress={progress} />;
  if (progress.status === 'notifications')
    return <NotificationsOnboardingStep progress={progress} />;
  return <ModelSourceOnboardingStep progress={progress} />;
}
