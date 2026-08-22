/**
 * ShieldGlyph — the GuardPay shield mark, drawn from Views.
 *
 * There is no SVG library in this project, so the crest is approximated with a
 * single View: square shoulders (large top radii) tapering to a rounded point
 * via bottom radii equal to half the width. Close to a heater shield at small
 * sizes; the point is softer than a true vector shield at large sizes.
 *
 * Purely decorative — callers own any label text.
 */

import React from 'react';
import { View, Text, StyleSheet, Animated, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../../theme';

export interface ShieldGlyphProps {
  /** Outer width in px; height is derived (1.16×) to keep the crest proportion. */
  size?: number;
  /** Fill colour of the shield body. */
  color?: string;
  /** Colour of the glyph rendered inside the shield. */
  glyphColor?: string;
  /** Decorative character shown inside, e.g. '✓' / '!' / '🔒'. */
  glyph?: string;
  /** Draw an outlined shield instead of a filled one. */
  outlined?: boolean;
  /** Soft halo ring behind the shield (used by the dashboard hero). */
  halo?: boolean;
  haloColor?: string;
  style?: StyleProp<ViewStyle>;
}

const HEIGHT_RATIO = 1.16;

export function ShieldGlyph({
  size = 48,
  color = theme.brand.blue,
  glyphColor = theme.neutral.textInverse,
  glyph = '✓',
  outlined = false,
  halo = false,
  haloColor = theme.brand.blueSoft,
  style,
}: ShieldGlyphProps) {
  const height = Math.round(size * HEIGHT_RATIO);
  const haloSize = Math.round(size * 1.55);

  const shield = (
    <View
      style={[
        styles.shield,
        {
          width: size,
          height,
          borderTopLeftRadius: Math.round(size * 0.24),
          borderTopRightRadius: Math.round(size * 0.24),
          borderBottomLeftRadius: Math.round(size * 0.5),
          borderBottomRightRadius: Math.round(size * 0.5),
          backgroundColor: outlined ? 'transparent' : color,
          borderWidth: outlined ? Math.max(2, Math.round(size * 0.07)) : 0,
          borderColor: color,
        },
      ]}
    >
      {glyph ? (
        <Text
          allowFontScaling={false}
          style={{
            fontSize: Math.round(size * 0.46),
            lineHeight: Math.round(size * 0.56),
            color: outlined ? color : glyphColor,
            fontWeight: '700',
            textAlign: 'center',
          }}
        >
          {glyph}
        </Text>
      ) : null}
    </View>
  );

  if (!halo) {
    return (
      <View style={style} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {shield}
      </View>
    );
  }

  return (
    <View
      style={[styles.haloWrap, { width: haloSize, height: haloSize, borderRadius: haloSize / 2, backgroundColor: haloColor }, style]}
      importantForAccessibility="no-hide-descendants"
      accessibilityElementsHidden
    >
      {shield}
    </View>
  );
}

/** Animated wrapper so heroes can pulse the shield without re-implementing it. */
export const AnimatedShieldWrap = Animated.createAnimatedComponent(View);

const styles = StyleSheet.create({
  shield: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  haloWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default ShieldGlyph;
