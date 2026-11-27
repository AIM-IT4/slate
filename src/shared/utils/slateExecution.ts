export const SLATE_EXECUTION_ENDPOINT = 'https://slate-execution.onrender.com/mcp';

/** The built-in execution service authenticates with a private bearer key. */
export function isSlateExecutionEndpoint(value: string | undefined): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return (
      url.origin === new URL(SLATE_EXECUTION_ENDPOINT).origin &&
      url.pathname.replace(/\/$/, '') === '/mcp'
    );
  } catch {
    return false;
  }
}
