export const STARTUP_MINIMUM_VISIBLE_MS = 800;
export const STARTUP_CONTENT_TIMEOUT_MS = 3_000;
export const STARTUP_ATTRIBUTION_ENTER_DURATION_MS = 260;
// Entrance played while the cover waits: one ring ripple and one logo breath, both finished
// inside STARTUP_MINIMUM_VISIBLE_MS so the exit never cuts them off on a fast start.
export const STARTUP_ATTRIBUTION_RISE_PX = 10;
export const STARTUP_RING_DURATION_MS = 720;
export const STARTUP_RING_SCALE = 1.9;
export const STARTUP_RING_OPACITY = 0.35;
export const STARTUP_LOGO_PULSE_SCALE = 1.05;
export const STARTUP_LOGO_PULSE_HALF_MS = 300;
export const STARTUP_EXIT_LOGO_SCALE = 1.15;
export const STARTUP_EXIT_LOGO_DURATION_MS = 320;
export const STARTUP_EXIT_FADE_DELAY_MS = 60;
export const STARTUP_EXIT_FADE_DURATION_MS = 280;

type StartupExitState = {
  bootstrapReady: boolean;
  contentReady: boolean;
  minimumElapsed: boolean;
  timedOut: boolean;
};

export function isStartupReadyToExit({
  bootstrapReady,
  contentReady,
  minimumElapsed,
  timedOut,
}: StartupExitState) {
  return bootstrapReady && minimumElapsed && (contentReady || timedOut);
}

export function getStartupExitDurationMs(reducedMotion: boolean) {
  return reducedMotion ? 0 : STARTUP_EXIT_FADE_DELAY_MS + STARTUP_EXIT_FADE_DURATION_MS;
}

export function normalizeStartupColorScheme(
  colorScheme: string | null | undefined,
): 'dark' | 'light' {
  return colorScheme === 'dark' ? 'dark' : 'light';
}
