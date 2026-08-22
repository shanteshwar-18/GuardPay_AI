/**
 * ProtectionSessionIndicator — the ambient "GuardPay Protection Active" pill.
 *
 * Shown while a protection session is running so the user can see the product
 * is watching. A subtly pulsing dot signals liveness; the loop uses the native
 * driver (opacity/scale only), never blocks touches (`pointerEvents="none"` is
 * not needed because the pill is non-interactive but it also never overlays
 * controls), and is STOPPED plus reset on unmount (§47).
 *
 * §48: the state is carried by the pre-translated `label` and a glyph as well as
 * the dot colour.
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { theme } from '../../theme';
import { useFontScale } from './useFontScale';

export type ProtectionSessionState = 'active' | 'evaluating' | 'complete';

export interface ProtectionSessionIndicatorProps {
  state: ProtectionSessionState;
  /** Pre-translated label, e.g. "GuardPay Protection Active". */
  label: string;
  /** Disable the pulse (tests, reduced-motion preference). */
  animate?: boolean;
  /** Stretch to the full row width instead of hugging its content. */
  fullWidth?: boolean;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface StatePalette {
  main: string;
  soft: string;
  border: string;
  text: string;
  glyph: string;
  pulses: boolean;
  /** Half-cycle duration; evaluating breathes faster to read as "working". */
  duration: number;
}

const STATES: Record<ProtectionSessionState, StatePalette> = {
  active: {
    main: theme.risk.safe.main,
    soft: theme.risk.safe.soft,
    border: theme.risk.safe.border,
    text: theme.risk.safe.dark,
    glyph: '🛡',
    pulses: true,
    duration: 1200,
  },
  evaluating: {
    main: theme.brand.blue,
    soft: theme.brand.blueSoft,
    border: theme.brand.blueMid,
    text: theme.brand.navy,
    glyph: '◌',
    pulses: true,
    duration: 650,
  },
  complete: {
    main: theme.risk.safe.dark,
    soft: theme.neutral.surfaceAlt,
    border: theme.neutral.border,
    text: theme.neutral.textSecondary,
    glyph: '✓',
    pulses: false,
    duration: 0,
  },
};

export function ProtectionSessionIndicator({
  state,
  label,
  animate = true,
  fullWidth = false,
  fontScale,
  style,
  testID,
}: ProtectionSessionIndicatorProps) {
  const { sf } = useFontScale(fontScale);
  const palette = STATES[state];
  const pulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!animate || !palette.pulses) {
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: palette.duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: palette.duration,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [animate, palette.duration, palette.pulses, pulse]);

  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.9],
  });
  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.6],
  });

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLiveRegion="polite"
      accessibilityLabel={label}
      style={[
        styles.pill,
        fullWidth ? styles.fullWidth : styles.hug,
        {
          backgroundColor: palette.soft,
          borderColor: palette.border,
          minHeight: sf(30),
        },
        style,
      ]}
    >
      <View style={styles.dotWrap}>
        <Animated.View
          style={[
            styles.halo,
            {
              backgroundColor: palette.main,
              opacity: haloOpacity,
              transform: [{ scale: haloScale }],
            },
          ]}
        />
        <View style={[styles.dot, { backgroundColor: palette.main }]} />
      </View>

      <Text
        allowFontScaling={false}
        style={[styles.glyph, { fontSize: sf(theme.typography.tiny.size), color: palette.text }]}
      >
        {palette.glyph}
      </Text>

      <Text
        allowFontScaling={false}
        numberOfLines={2}
        style={[
          styles.label,
          { fontSize: sf(theme.typography.caption.size), color: palette.text },
        ]}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
  },
  hug: {
    alignSelf: 'center',
  },
  fullWidth: {
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  dotWrap: {
    width: 14,
    height: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  halo: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  glyph: {
    marginRight: theme.spacing.xs,
    fontWeight: '700',
  },
  label: {
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
});

export default ProtectionSessionIndicator;
