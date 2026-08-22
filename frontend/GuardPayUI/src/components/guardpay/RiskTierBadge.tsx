/**
 * RiskTierBadge — small tier pill for history rows, cards and headers.
 *
 * Colour is always paired with the tier glyph and the pre-translated word, so
 * the badge is never a colour-only signal (§48).
 */

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../../theme';
import { RiskTierId, getTierConfig, resolveTier } from '../../config/riskTiers';
import { useFontScale } from './useFontScale';

export type RiskTierBadgeSize = 'sm' | 'md' | 'lg';

export interface RiskTierBadgeProps {
  /** Preferred: the tier the backend decided. */
  tier?: RiskTierId;
  /** Fallback when only a score is available (resolved via riskTiers). */
  score?: number;
  size?: RiskTierBadgeSize;
  /** Pre-translated tier word — required, this component never calls t(). */
  label: string;
  /** Hide the decorative glyph and show the word alone. */
  hideGlyph?: boolean;
  /** Solid fill instead of the default soft tint. */
  solid?: boolean;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SIZES: Record<RiskTierBadgeSize, { font: number; padH: number; padV: number }> = {
  sm: { font: theme.typography.tiny.size, padH: theme.spacing.sm, padV: 3 },
  md: { font: theme.typography.caption.size, padH: theme.spacing.md, padV: 5 },
  lg: { font: theme.typography.bodyBold.size, padH: theme.spacing.lg, padV: 8 },
};

export function RiskTierBadge({
  tier,
  score,
  size = 'md',
  label,
  hideGlyph = false,
  solid = false,
  fontScale,
  style,
  testID,
}: RiskTierBadgeProps) {
  const { sf } = useFontScale(fontScale);
  const resolved: RiskTierId =
    tier ?? (typeof score === 'number' ? resolveTier(null, score) : 'SAFE');
  const cfg = getTierConfig(resolved);
  const dims = SIZES[size];

  const bg = solid ? cfg.color : cfg.softColor;
  const fg = solid ? theme.neutral.textInverse : cfg.darkColor;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={label}
      style={[
        styles.pill,
        {
          backgroundColor: bg,
          borderColor: solid ? cfg.color : cfg.borderColor,
          paddingHorizontal: dims.padH,
          paddingVertical: dims.padV,
        },
        style,
      ]}
    >
      {!hideGlyph ? (
        <Text
          allowFontScaling={false}
          style={[styles.glyph, { fontSize: sf(dims.font), color: fg }]}
        >
          {cfg.icon}
        </Text>
      ) : null}
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.text, { fontSize: sf(dims.font), color: fg }]}
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
    alignSelf: 'flex-start',
    borderRadius: theme.radius.pill,
    borderWidth: 1,
  },
  glyph: {
    fontWeight: '700',
    marginRight: theme.spacing.xs,
  },
  text: {
    fontWeight: '700',
    letterSpacing: 0.2,
    flexShrink: 1,
  },
});

export default RiskTierBadge;
