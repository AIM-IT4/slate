export function slateProviderOrigin(providerId: string): string | undefined {
  switch (providerId) {
    case 'anthropic':
      return 'https://api.anthropic.com';
    case 'openai':
      return 'https://api.openai.com';
    default:
      return undefined;
  }
}
