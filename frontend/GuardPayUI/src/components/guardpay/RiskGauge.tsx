/**
 * RiskGauge — the hero visual on every decision screen.
 *
 * TREATMENT: a thick, rounded horizontal TRACK (not a ring).
 * There is no SVG library in this project, so a true arc would have to be faked
 * from two rotated half-circles clipped by `overflow:'hidden'` — a technique that
 * renders inconsistently on Android (radius + rotation + clipping) and cannot be
 * anti-aliased. A thick pill track with an animated coloured fill, tier ticks and
 * a large numeric readout is the treatment that actually looks clean on both
 * platforms, and it reads like a credit-score meter, which is familiar in Indian
 * consumer fintech.
 *
 * The fill animates 0 → score with `Animated` (`useNativeDriver:false`, because
 * width is a layout property).
 *
 * Senior Citizen Mode (§25): with `hideNumber` the gauge shows COLOUR + WORD +
 * GLYPH only — no digits anywhere, including the tick labels — and the
 * accessibility label states the severity in words.
 *
 * All user-facing copy arrives pre-translated via props (§26).
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
import {
  RiskTierId,
  getTierConfig,
  RISK_THRESHOLDS,
} from '../../config/riskTiers';
import { useFontScale } from './useFontScale';

export interface RiskGaugeProps {
  /** Risk score 0–100 (clamped). */
  score: number;
  /** Tier as resolved by config/riskTiers (backend-authoritative). */
  tier: RiskTierId;
  /** Overall gauge width in px; thickness and type sizes derive from it. */
  size?: number;
  /**
   * Senior Citizen Mode: render colour + word + glyph only, never digits.
   */
  hideNumber?: boolean;
  /** Pre-translated tier word, e.g. "Safe" / "सुरक्षित". Shown under the track. */
  label?: string;
  /** Optional pre-translated caption below the label. */
  caption?: string;
  /** Override the composed screen-reader sentence. */
  accessibilityLabel?: string;
  /** Override Senior Citizen Mode font scaling. */
  fontScale?: number;
  /** Set false to render the final value with no entry animation. */
  animate?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const ANIM_DURATION_MS = 900;

/** Tick positions come from the single source of truth, never re-declared. */
const TICKS: number[] = [
  RISK_THRESHOLDS.warning,
  RISK_THRESHOLDS.hold,
  RISK_THRESHOLDS.intercept,
];

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

export function RiskGauge({
  score,
  tier,
  size = 260,
  hideNumber = false,
  label,
  caption,
  accessibilityLabel,
  fontScale,
  animate = true,
  style,
  testID,
}: RiskGaugeProps) {
  const { sf } = useFontScale(fontScale);
  const cfg = getTierConfig(tier);
  const target = clamp(score);

  const progress = useRef(new Animated.Value(animate ? 0 : 1)).current;
  const [displayScore, setDisplayScore] = useState(animate ? 0 : target);

  // 0 → score fill. Layout property, so the native driver cannot be used.
  useEffect(() => {
    if (!animate) {
      progress.setValue(1);
      setDisplayScore(target);
      return;
    }
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: ANIM_DURATION_MS,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    animation.start();
    return () => {
      animation.stop();
    };
  }, [animate, progress, target]);

  // Count the readout up alongside the fill. Skipped entirely when digits are
  // hidden, so Senior Citizen Mode does no needless per-frame work.
  useEffect(() => {
    if (hideNumber) return;
    if (!animate) {
      setDisplayScore(target);
      return;
    }
    const id = progress.addListener(({ value }) => {
      const next = Math.round(value * target);
      setDisplayScore(prev => (prev === next ? prev : next));
    });
    return () => {
      progress.removeListener(id);
    };
  }, [animate, hideNumber, progress, target]);

  const trackHeight = Math.max(14, Math.min(28, Math.round(size * 0.085)));
  const fillWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', `${target}%`],
  });

  const a11yLabel = useMemo(() => {
    if (accessibilityLabel) return accessibilityLabel;
    if (hideNumber) return label ?? tier;
    return label ? `${label} ${target}` : `${tier} ${target}`;
  }, [accessibilityLabel, hideNumber, label, target, tier]);

  return (
    <View
      testID={testID}
      style={[styles.wrap, { width: size }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={a11yLabel}
      accessibilityValue={
        hideNumber
          ? { text: a11yLabel }
          : { min: 0, max: 100, now: target, text: a11yLabel }
      }
    >
      {/* Readout ─ digits, or glyph-only in Senior Citizen Mode */}
      <View
        style={styles.readout}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        {hideNumber ? (
          <View
            style={[
              styles.glyphPuck,
              {
                width: sf(64),
                height: sf(64),
                borderRadius: sf(32),
                backgroundColor: cfg.softColor,
                borderColor: cfg.color,
              },
            ]}
          >
            <Text
              allowFontScaling={false}
              style={[styles.glyph, { fontSize: sf(28), color: cfg.darkColor }]}
            >
              {cfg.icon}
            </Text>
          </View>
        ) : (
          <Text
            allowFontScaling={false}
            style={[
              styles.score,
              {
                fontSize: sf(theme.typography.display.size + 12),
                lineHeight: sf(theme.typography.display.size + 18),
                color: cfg.darkColor,
              },
            ]}
          >
            {displayScore}
          </Text>
        )}
      </View>

      {/* Track */}
      <View
        style={[
          styles.track,
          {
            height: trackHeight,
            borderRadius: trackHeight / 2,
          },
        ]}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Animated.View
          style={[
            styles.fill,
            {
              width: fillWidth,
              borderRadius: trackHeight / 2,
              backgroundColor: cfg.color,
            },
          ]}
        />
        {/* Tier boundary ticks — hidden with digits so the senior view stays
            purely qualitative. */}
        {!hideNumber &&
          TICKS.map(t => (
            <View
              key={t}
              style={[
                styles.tick,
                { left: `${t}%`, height: trackHeight, width: 2 },
              ]}
            />
          ))}
      </View>

      {/* Tier word — colour is NEVER the only signal (§48) */}
      {label ? (
        <View
          style={[
            styles.labelPill,
            {
              backgroundColor: cfg.softColor,
              borderColor: cfg.borderColor,
              minHeight: sf(30),
            },
          ]}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {!hideNumber ? (
            <Text
              allowFontScaling={false}
              style={[styles.labelGlyph, { fontSize: sf(13), color: cfg.darkColor }]}
            >
              {cfg.icon}
            </Text>
          ) : null}
          <Text
            allowFontScaling={false}
            numberOfLines={2}
            style={[
              styles.labelText,
              {
                fontSize: sf(hideNumber ? theme.typography.h2.size : theme.typography.bodyBold.size),
                color: cfg.darkColor,
              },
            ]}
          >
            {label}
          </Text>
        </View>
      ) : null}

      {caption ? (
        <Text
          allowFontScaling={false}
          style={[styles.caption, { fontSize: sf(theme.typography.caption.size) }]}
        >
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    alignSelf: 'center',
  },
  readout: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  score: {
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: -1,
  },
  glyphPuck: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  glyph: {
    fontWeight: '700',
    textAlign: 'center',
  },
  track: {
    width: '100%',
    backgroundColor: theme.neutral.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.neutral.border,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
  },
  tick: {
    position: 'absolute',
    top: 0,
    backgroundColor: theme.neutral.white,
    opacity: 0.75,
  },
  labelPill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: theme.spacing.lg,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  labelGlyph: {
    fontWeight: '700',
    marginRight: theme.spacing.sm,
  },
  labelText: {
    fontWeight: '700',
    textAlign: 'center',
    flexShrink: 1,
  },
  caption: {
    marginTop: theme.spacing.sm,
    color: theme.neutral.textSecondary,
    textAlign: 'center',
  },
});

export default RiskGauge;
