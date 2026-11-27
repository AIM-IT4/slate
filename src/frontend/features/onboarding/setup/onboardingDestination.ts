export function getOnboardingDestination(models: {
  hasModels: boolean;
  isLoading: boolean;
  isError: boolean;
}) {
  if (models.isLoading) return 'loading';
  if (models.isError) return 'retry';
  return models.hasModels ? 'model' : 'source';
}
