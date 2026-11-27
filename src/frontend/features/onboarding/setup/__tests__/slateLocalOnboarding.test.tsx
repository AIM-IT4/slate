import { OnboardingScreen } from '../../OnboardingScreen';
import { ModelSourceOnboardingStep } from '../ModelSourceOnboardingStep';
import type { OnboardingStatus } from '../useOnboardingProgress';

let mockStatus: OnboardingStatus;

jest.mock('@/frontend/appShell/privacy', () => ({ usePrivacyConsentPending: () => false }));
jest.mock('../useOnboardingProgress', () => ({
  useOnboardingProgress: () => ({ status: mockStatus }),
}));
jest.mock('../IntroOnboardingStep', () => ({ IntroOnboardingStep: () => null }));
jest.mock('../ModelSourceOnboardingStep', () => ({ ModelSourceOnboardingStep: () => null }));
jest.mock('../NotificationsOnboardingStep', () => ({ NotificationsOnboardingStep: () => null }));
jest.mock('../PermissionsOnboardingStep', () => ({ PermissionsOnboardingStep: () => null }));
jest.mock('expo-router', () => ({ Redirect: () => null }));

test.each<OnboardingStatus>(['login', 'pending'])(
  'resumes the %s setup stage at API provider selection',
  (status) => {
    mockStatus = status;
    expect(OnboardingScreen().type).toBe(ModelSourceOnboardingStep);
  },
);
