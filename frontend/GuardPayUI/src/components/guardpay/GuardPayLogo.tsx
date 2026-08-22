/**
 * GuardPayLogo — shield mark + wordmark.
 *
 * "GuardPay" / "AI" are brand marks, not translatable copy, so they are the one
 * literal allowed here. The tagline IS copy and must be supplied already
 * translated via the `tagline` prop.
 */

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../../theme';
import { ShieldGlyph } from './ShieldGlyph';
import { useFontScale } from './useFontScale';

export type LogoSize = 'sm' | 'md' | 'lg';
export type LogoVariant = 'light' | 'dark';

export interface GuardPayLogoProps {
  size?: LogoSize;
  /** 'light' = for light surfaces (navy text); 'dark' = for navy surfaces (white text). */
  variant?: LogoVariant;
  /** Render the tagline line. Requires `tagline`. */
  showTagline?: boolean;
  /** Already-translated tagline copy. */
  tagline?: string;
  /** Stack the wordmark under the shield instead of beside it. */
  stacked?: boolean;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const SIZES: Record<LogoSize, { shield: number; word: number; tagline: number; gap: number }> = {
  sm: { shield: 22, word: theme.typography.h3.size, tagline: theme.typography.tiny.size, gap: theme.spacing.sm },
  md: { shield: 34, word: theme.typography.h1.size, tagline: theme.typography.caption.size, gap: theme.spacing.md },
  lg: { shield: 56, word: theme.typography.display.size, tagline: theme.typography.body.size, gap: theme.spacing.lg },
};

export function GuardPayLogo({
  size = 'md',
  variant = 'light',
  showTagline = false,
  tagline,
  stacked = false,
  fontScale,
  style,
  testID,
}: GuardPayLogoProps) {
  const { sf } = useFontScale(fontScale);
  const dims = SIZES[size];
  const onDark = variant === 'dark';

  const wordColor = onDark ? theme.neutral.textInverse : theme.brand.navy;
  const accentColor = onDark ? theme.brand.blueMid : theme.brand.blue;
  const taglineColor = onDark ? theme.neutral.textMuted : theme.neutral.textSecondary;

  return (
    <View
      style={[stacked ? styles.stacked : styles.row, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={tagline ? `GuardPay AI. ${tagline}` : 'GuardPay AI'}
      testID={testID}
    >
      <ShieldGlyph
        size={dims.shield}
        color={onDark ? theme.brand.blueMid : theme.brand.blue}
        glyphColor={onDark ? theme.brand.navyDeep : theme.neutral.textInverse}
        glyph="✓"
      />

      <View style={stacked ? styles.stackedText : { marginLeft: dims.gap }}>
        <Text
          allowFontScaling={false}
          style={[
            styles.word,
            { fontSize: sf(dims.word), lineHeight: sf(Math.round(dims.word * 1.2)), color: wordColor },
          ]}
        >
          GuardPay
          <Text style={{ color: accentColor }}> AI</Text>
        </Text>

        {showTagline && tagline ? (
          <Text
            allowFontScaling={false}
            style={[
              styles.tagline,
              { fontSize: sf(dims.tagline), lineHeight: sf(Math.round(dims.tagline * 1.4)), color: taglineColor },
            ]}
          >
            {tagline}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stacked: {
    alignItems: 'center',
  },
  stackedText: {
    alignItems: 'center',
    marginTop: theme.spacing.md,
  },
  word: {
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  tagline: {
    fontWeight: '500',
    marginTop: theme.spacing.xs,
  },
});

export default GuardPayLogo;
