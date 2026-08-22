/**
 * SecurityStatusCard — the dashboard hero.
 *
 * Large shield crest, headline, supporting subtext and a status dot that pulses
 * softly while protection is live. The pulse is decorative and non-blocking: it
 * is an `Animated.loop` on opacity/scale only (native driver), and it is stopped
 * and the value reset on unmount (§47).
 *
 * §48: the state is carried by the headline text and the shield glyph, never by
 * the dot colour alone.
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
import { SecurityTone } from './types';
import { ShieldGlyph } from './ShieldGlyph';
import { useFontScale } from './useFontScale';

export interface SecurityStatusCardProps {
  /** Pre-translated headline, e.g. "You are protected". */
  title: string;
  /** Pre-translated supporting line. */
  subtitle: string;
  tone: SecurityTone;
  /** Optional pre-translated status word rendered beside the dot. */
  statusLabel?: string;
  /** Optional trailing element (e.g. a settings affordance). */
  rightSlot?: React.ReactNode;
  /** Disable the pulse (tests, reduced-motion preference). */
  animate?: boolean;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

interface TonePalette {
  main: string;
  soft: string;
  border: string;
  dark: string;
  glyph: string;
  /** Only the live state pulses; a dead state that breathes reads as alive. */
  pulses: boolean;
}

const TONES: Record<SecurityTone, TonePalette> = {
  protected: {
    main: theme.risk.safe.main,
    soft: theme.risk.safe.soft,
    border: theme.risk.safe.border,
    dark: theme.risk.safe.dark,
    glyph: '✓',
    pulses: true,
  },
  inactive: {
    main: theme.neutral.textMuted,
    soft: theme.neutral.surfaceAlt,
    border: theme.neutral.borderStrong,
    dark: theme.neutral.textSecondary,
    glyph: '–',
    pulses: false,
  },
  alert: {
    main: theme.risk.intercept.main,
    soft: theme.risk.intercept.soft,
    border: theme.risk.intercept.border,
    dark: theme.risk.intercept.dark,
    glyph: '!',
    pulses: true,
  },
};

export function SecurityStatusCard({
  title,
  subtitle,
  tone,
  statusLabel,
  rightSlot,
  animate = true,
  fontScale,
  style,
  testID,
}: SecurityStatusCardProps) {
  const { sf } = useFontScale(fontScale);
  const palette = TONES[tone];
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
          duration: 1400,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1400,
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
  }, [animate, palette.pulses, pulse]);

  const haloOpacity = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [0.35, 0.85],
  });
  const haloScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.45],
  });

  const a11yLabel = [title, statusLabel, subtitle].filter(Boolean).join('. ');

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={a11yLabel}
      style={[
        styles.card,
        { backgroundColor: palette.soft, borderColor: palette.border },
        style,
      ]}
    >
      <View style={styles.shieldWrap}>
        <ShieldGlyph
          size={sf(52)}
          color={palette.main}
          glyph={palette.glyph}
          glyphColor={theme.neutral.textInverse}
        />
      </View>

      <View style={styles.body}>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[
            styles.title,
            {
              fontSize: sf(theme.typography.h2.size),
              lineHeight: sf(theme.typography.h2.lineHeight),
            },
          ]}
        >
          {title}
        </Text>

        <Text
          allowFontScaling={false}
          numberOfLines={3}
          style={[
            styles.subtitle,
            {
              fontSize: sf(theme.typography.body.size),
              lineHeight: sf(theme.typography.body.lineHeight),
            },
          ]}
        >
          {subtitle}
        </Text>

        {statusLabel ? (
          <View style={styles.statusRow}>
            <View style={styles.dotWrap}>
              <Animated.View
                style={[
                  styles.dotHalo,
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
              numberOfLines={2}
              style={[
                styles.statusText,
                { fontSize: sf(theme.typography.caption.size), color: palette.dark },
              ]}
            >
              {statusLabel}
            </Text>
          </View>
        ) : null}
      </View>

      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: theme.radius.xl,
    borderWidth: 1,
    padding: theme.spacing.xl,
    ...theme.elevation.sm,
  },
  shieldWrap: {
    marginRight: theme.spacing.lg,
  },
  body: {
    flex: 1,
  },
  title: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: theme.spacing.xs,
    color: theme.neutral.textSecondary,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  dotWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: theme.spacing.sm,
  },
  dotHalo: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontWeight: '700',
    flexShrink: 1,
    letterSpacing: 0.2,
  },
  rightSlot: {
    marginLeft: theme.spacing.md,
  },
});

export default SecurityStatusCard;
