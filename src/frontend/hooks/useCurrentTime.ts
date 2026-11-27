import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

/** A wall clock that refreshes on activation and foregrounding, and stops when unused. */
export function useCurrentTime(isActive: boolean, intervalMs = 60_000): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    if (!isActive) return;
    const update = () => setNow(Date.now());
    const initial = setTimeout(update, 0);
    const timer = setInterval(update, intervalMs);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') update();
    });
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
      subscription.remove();
    };
  }, [intervalMs, isActive]);
  return now;
}
