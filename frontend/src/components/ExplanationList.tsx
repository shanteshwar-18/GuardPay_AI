/**
 * ExplanationList — SHAP Factor Breakdown
 *
 * Renders the backend's explanation strings as a styled bulleted list.
 * Used by WarningScreen and HoldScreen.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RiskTier } from '../types';
import { TIER_COLORS, colors, typography, spacing, radius } from '../theme';

interface ExplanationListProps {
  explanations: string[];
  tier: RiskTier;
}

export default function ExplanationList({ explanations, tier }: ExplanationListProps) {
  const tierColor = TIER_COLORS[tier];

  if (!explanations || explanations.length === 0) return null;

  return (
    <View
      style={styles.container}
      accessible={true}
      accessibilityRole="summary"
      accessibilityLabel="Risk Factor Breakdown"
    >
      <Text style={styles.heading}>Risk Factor Breakdown</Text>
      {explanations.map((item, index) => (
        <View
          key={index}
          style={styles.row}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={`Factor ${index + 1}: ${item}`}
        >
          <View style={[styles.bullet, { backgroundColor: tierColor }]} />
          <Text style={styles.text}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
  },
  heading: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: spacing.sm,
    paddingRight: spacing.sm,
  },
  bullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
    marginRight: spacing.sm,
    flexShrink: 0,
  },
  text: {
    fontSize: typography.bodySmall,
    color: colors.text,
    flex: 1,
    lineHeight: 20,
  },
});
