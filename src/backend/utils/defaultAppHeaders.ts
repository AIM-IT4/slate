/** Identifying headers attached to outbound AI-provider and web-search requests. */
export function defaultAppHeaders(): Record<string, string> {
  return {
    'User-Agent': 'Slate/1.0',
    'X-App-Name': 'Slate',
  };
}
