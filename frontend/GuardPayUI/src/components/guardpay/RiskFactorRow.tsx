/**
 * RiskFactorRow — one row of the "What We Checked" list.
 *
 * Layout: leading severity glyph · factor name (+ optional plain-language
 * explanation) · right-aligned severity word, colour-coded.
 *
 * §18: the row leads with plain language. The numeric weight is optional and is
 * suppressed entirely by `hidePoints` (Senior Citizen Mode), matching the
 * `hidePoints` convention already used by components/RiskFactorList.tsx.
 *
 * §48: severity is carried by the WORD and the GLYPH as well as the colour.
 */

import React from 'react';
import { View, Text, StyleSheet, StyleProp, ViewStyle } from 'react-native';
import { theme } from '../../theme';
import { FactorSeverity, SEVERITY_COLORS, SEVERITY_GLYPHS } from './types';
import { useFontScale } from './useFontScale';

export interface RiskFactorRowProps {
  /** Factor name — already translated / plain language. */
  name: string;
  severity: FactorSeverity;
  /** Optional one-line plain-language explanation shown under the name. */
  explanation?: string;
  /** Senior Citizen Mode: suppress the numeric weight badge. */
  hidePoints?: boolean;
  /** Numeric weight from the backend `factors[]` entry. */
  points?: number;
  /**
   * Pre-translated severity word shown on the right. Falls back to the machine
   * key so a missing translation degrades to something readable rather than to
   * colour alone.
   */
  severityLabel?: string;
  /**
   * Pre-formatted weight label (e.g. "+12 pts"). When omitted the raw signed
   * number is rendered — digits only, so no untranslated unit leaks in.
   */
  pointsLabel?: string;
  /** Drop the bottom hairline (last row in a list). */
  isLast?: boolean;
  fontScale?: number;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function RiskFactorRow({
  name,
  severity,
  explanation,
  hidePoints = false,
  points,
  severityLabel,
  pointsLabel,
  isLast = false,
  fontScale,
  style,
  testID,
}: RiskFactorRowProps) {
  const { sf } = useFontScale(fontScale);
  const palette = SEVERITY_COLORS[severity];
  const glyph = SEVERITY_GLYPHS[severity];
  const word = severityLabel ?? severity;
  const showPoints = !hidePoints && typeof points === 'number';

  const a11yParts = [name, word];
  if (explanation) a11yParts.push(explanation);
  if (showPoints) a11yParts.push(pointsLabel ?? String(points));

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={a11yParts.join('. ')}
      style={[
        styles.row,
        !isLast && styles.divider,
        { minHeight: Math.max(theme.control.minTouch, sf(44)) },
        style,
      ]}
    >
      {/* Leading severity glyph in a tinted puck */}
      <View
        style={[
          styles.puck,
          {
            width: sf(28),
            height: sf(28),
            borderRadius: sf(14),
            backgroundColor: palette.soft,
            borderColor: palette.border,
          },
        ]}
      >
        <Text
          allowFontScaling={false}
          style={[styles.puckGlyph, { fontSize: sf(13), color: palette.main }]}
        >
          {glyph}
        </Text>
      </View>

      {/* Name + plain-language explanation */}
      <View style={styles.body}>
        <Text
          allowFontScaling={false}
          numberOfLines={3}
          style={[
            styles.name,
            {
              fontSize: sf(theme.typography.body.size),
              lineHeight: sf(theme.typography.body.lineHeight),
            },
          ]}
        >
          {name}
        </Text>
        {explanation ? (
          <Text
            allowFontScaling={false}
            numberOfLines={4}
            style={[
              styles.explanation,
              {
                fontSize: sf(theme.typography.caption.size),
                lineHeight: sf(theme.typography.caption.lineHeight),
              },
            ]}
          >
            {explanation}
          </Text>
        ) : null}
      </View>

      {/* Right-aligned severity word (+ optional weight) */}
      <View style={styles.trailing}>
        <Text
          allowFontScaling={false}
          numberOfLines={2}
          style={[
            styles.severityWord,
            { fontSize: sf(theme.typography.caption.size), color: palette.main },
          ]}
        >
          {word}
        </Text>
        {showPoints ? (
          <Text
            allowFontScaling={false}
            style={[styles.points, { fontSize: sf(theme.typography.tiny.size) }]}
          >
            {pointsLabel ?? `+${points}`}
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
    paddingVertical: theme.spacing.md,
    paddingHorizontal: theme.spacing.xs,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.neutral.border,
  },
  puck: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    marginRight: theme.spacing.md,
    flexShrink: 0,
  },
  puckGlyph: {
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    flex: 1,
    paddingRight: theme.spacing.sm,
  },
  name: {
    color: theme.neutral.textPrimary,
    fontWeight: '600',
  },
  explanation: {
    marginTop: 2,
    color: theme.neutral.textSecondary,
  },
  trailing: {
    alignItems: 'flex-end',
    flexShrink: 0,
    maxWidth: '34%',
  },
  severityWord: {
    fontWeight: '700',
    textAlign: 'right',
    textTransform: 'capitalize',
  },
  points: {
    marginTop: 2,
    color: theme.neutral.textMuted,
    fontWeight: '600',
    textAlign: 'right',
  },
});

export default RiskFactorRow;
