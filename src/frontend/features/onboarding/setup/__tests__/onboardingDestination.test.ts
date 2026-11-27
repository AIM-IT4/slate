import { getOnboardingDestination } from '../onboardingDestination';

const models = { hasModels: false, isLoading: false, isError: false };

test('continues directly to local model setup', () => {
  expect(getOnboardingDestination(models)).toBe('source');
  expect(getOnboardingDestination({ ...models, hasModels: true })).toBe('model');
});

test('keeps local model discovery loading and retryable', () => {
  expect(getOnboardingDestination({ ...models, isLoading: true })).toBe('loading');
  expect(getOnboardingDestination({ ...models, isError: true })).toBe('retry');
});
