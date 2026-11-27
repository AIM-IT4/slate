import { easing } from '@cherrystudio/ui/motion';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { recordStartupEvent } from '@/shared/core/logger/startupDiagnostics';

import {
  getStartupExitDurationMs,
  STARTUP_ATTRIBUTION_ENTER_DURATION_MS,
  STARTUP_ATTRIBUTION_RISE_PX,
  STARTUP_EXIT_FADE_DELAY_MS,
  STARTUP_EXIT_FADE_DURATION_MS,
  STARTUP_EXIT_LOGO_DURATION_MS,
  STARTUP_EXIT_LOGO_SCALE,
  STARTUP_LOGO_PULSE_HALF_MS,
  STARTUP_LOGO_PULSE_SCALE,
  STARTUP_RING_DURATION_MS,
  STARTUP_RING_OPACITY,
  STARTUP_RING_SCALE,
} from './startupState';

const STARTUP_LOGO = require('@/assets/icon.png');
const LOGO_SIZE = 96;
const ATTRIBUTION_SAFE_AREA_GAP = 48;
// The fade starts slowly so the logo's growth is readable before the cover thins out.
const coverFadeEasing = Easing.inOut(Easing.cubic);

const BRAND_RED = '#FF5757';

/*
 * Entrance motion (owned here): once the cover is presented, a brand ring ripples out from the
 * logo, the logo takes one gentle breath and the wordmark rises into place. The first frame matches
 * the native splash exactly (logo at scale 1, ring invisible), so the hand-off never flickers. The
 * exit animation interrupts the breath from its current scale. Reduce Motion shows a static cover.
 */
const colors = {
  dark: {
    background: '#000000',
  },
  light: {
    background: '#FFFFFF',
  },
} as const;

type StartupCoverProps = {
  colorScheme: 'dark' | 'light';
  coverPresented: boolean;
  exitRequested: boolean;
  onExitComplete: () => void;
  onLayout: () => void;
};

export function StartupCover({
  colorScheme,
  coverPresented,
  exitRequested,
  onExitComplete,
  onLayout,
}: StartupCoverProps) {
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();
  const attributionOpacity = useSharedValue(reducedMotion ? 1 : 0);
  const attributionRise = useSharedValue(reducedMotion ? 0 : STARTUP_ATTRIBUTION_RISE_PX);
  const coverOpacity = useSharedValue(1);
  const logoScale = useSharedValue(1);
  const ringOpacity = useSharedValue(0);
  const ringScale = useSharedValue(1);
  const palette = colors[colorScheme];
  const exitDurationMs = getStartupExitDurationMs(reducedMotion);
  const attributionStyle = useAnimatedStyle(() => ({
    opacity: attributionOpacity.get(),
    transform: [{ translateY: attributionRise.get() }],
  }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.get(),
    transform: [{ scale: ringScale.get() }],
  }));
  const coverStyle = useAnimatedStyle(() => ({ opacity: coverOpacity.get() }));
  const logoStyle = useAnimatedStyle(() => ({ transform: [{ scale: logoScale.get() }] }));

  useEffect(() => {
    if (!coverPresented) {
      return;
    }

    if (reducedMotion) {
      attributionOpacity.set(1);
      attributionRise.set(0);
      return;
    }

    const enter = {
      duration: STARTUP_ATTRIBUTION_ENTER_DURATION_MS,
      easing: easing.settle,
      reduceMotion: ReduceMotion.System,
    };
    attributionOpacity.set(withTiming(1, enter));
    attributionRise.set(withTiming(0, enter));
    ringOpacity.set(
      withSequence(
        withTiming(STARTUP_RING_OPACITY, { duration: 80, reduceMotion: ReduceMotion.System }),
        withTiming(0, {
          duration: STARTUP_RING_DURATION_MS - 80,
          easing: Easing.out(Easing.quad),
          reduceMotion: ReduceMotion.System,
        }),
      ),
    );
    ringScale.set(
      withTiming(STARTUP_RING_SCALE, {
        duration: STARTUP_RING_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        reduceMotion: ReduceMotion.System,
      }),
    );
    logoScale.set(
      withSequence(
        withTiming(STARTUP_LOGO_PULSE_SCALE, {
          duration: STARTUP_LOGO_PULSE_HALF_MS,
          easing: Easing.inOut(Easing.sin),
          reduceMotion: ReduceMotion.System,
        }),
        withTiming(1, {
          duration: STARTUP_LOGO_PULSE_HALF_MS,
          easing: Easing.inOut(Easing.sin),
          reduceMotion: ReduceMotion.System,
        }),
      ),
    );
  }, [
    attributionOpacity,
    attributionRise,
    coverPresented,
    logoScale,
    reducedMotion,
    ringOpacity,
    ringScale,
  ]);

  useEffect(() => {
    if (!exitRequested) {
      return;
    }

    recordStartupEvent('startup.cover.exit', 'started');
    cancelAnimation(ringOpacity);
    ringOpacity.set(0);
    if (exitDurationMs === 0) {
      onExitComplete();
      return;
    }

    logoScale.set(
      withTiming(STARTUP_EXIT_LOGO_SCALE, {
        duration: STARTUP_EXIT_LOGO_DURATION_MS,
        easing: easing.settle,
        reduceMotion: ReduceMotion.System,
      }),
    );
    coverOpacity.set(
      withDelay(
        STARTUP_EXIT_FADE_DELAY_MS,
        withTiming(
          0,
          {
            duration: STARTUP_EXIT_FADE_DURATION_MS,
            easing: coverFadeEasing,
            reduceMotion: ReduceMotion.System,
          },
          (finished) => {
            if (finished) {
              scheduleOnRN(onExitComplete);
            }
          },
        ),
        ReduceMotion.System,
      ),
    );
  }, [coverOpacity, exitDurationMs, exitRequested, logoScale, onExitComplete, ringOpacity]);

  useEffect(() => {
    return () => {
      cancelAnimation(attributionOpacity);
      cancelAnimation(attributionRise);
      cancelAnimation(coverOpacity);
      cancelAnimation(logoScale);
      cancelAnimation(ringOpacity);
      cancelAnimation(ringScale);
    };
  }, [attributionOpacity, attributionRise, coverOpacity, logoScale, ringOpacity, ringScale]);

  return (
    <Animated.View
      accessibilityViewIsModal
      collapsable={false}
      pointerEvents="auto"
      style={[styles.cover, { backgroundColor: palette.background }, coverStyle]}
      testID="startup-cover"
      onLayout={onLayout}
    >
      <StatusBar animated={false} style={colorScheme === 'dark' ? 'light' : 'dark'} />
      <View pointerEvents="none" style={styles.logoContainer}>
        <Animated.View style={[styles.ring, ringStyle]} />
        <Animated.Image
          accessibilityIgnoresInvertColors
          accessible={false}
          resizeMode="contain"
          source={STARTUP_LOGO}
          style={[styles.logo, logoStyle]}
        />
      </View>
      <Animated.View
        accessible={false}
        pointerEvents="none"
        style={[
          styles.attribution,
          { bottom: insets.bottom + ATTRIBUTION_SAFE_AREA_GAP },
          attributionStyle,
        ]}
      >
        <Text accessible={false} allowFontScaling={false} style={styles.brandText}>
          Slate
        </Text>
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  attribution: {
    alignItems: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
  },
  brandText: {
    color: BRAND_RED,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0,
    lineHeight: 24,
  },
  cover: {
    bottom: 0,
    elevation: 1_000,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    zIndex: 1_000,
  },
  logo: {
    height: LOGO_SIZE,
    width: LOGO_SIZE,
  },
  ring: {
    borderColor: BRAND_RED,
    borderRadius: LOGO_SIZE / 2,
    borderWidth: 2,
    height: LOGO_SIZE,
    position: 'absolute',
    width: LOGO_SIZE,
  },
  logoContainer: {
    alignItems: 'center',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
