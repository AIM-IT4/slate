export type ToolElapsed =
  | { unit: 'seconds'; value: number }
  | { unit: 'minutes'; value: number }
  | { unit: 'hours'; value: number };

const roundOneDecimal = (value: number) => Math.round(value * 10) / 10;

/**
 * Picks the unit people read most easily: whole seconds under a minute, then minutes and hours
 * with one decimal (70 s -> 1.2 min, 1180 s -> 19.7 min, 5400 s -> 1.5 h).
 */
export function toToolElapsed(elapsedMs: number): ToolElapsed {
  const seconds = Number.isFinite(elapsedMs) ? Math.max(0, Math.floor(elapsedMs / 1000)) : 0;
  if (seconds < 60) return { unit: 'seconds', value: seconds };
  const minutes = roundOneDecimal(seconds / 60);
  if (minutes < 60) return { unit: 'minutes', value: minutes };
  return { unit: 'hours', value: roundOneDecimal(seconds / 3600) };
}
