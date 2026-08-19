/**
 * GuardPay AI — Shared RiskFactorList Component
 * Renders SHAP risk factor breakdown list.
 * Used by WarningScreen AND InterceptScreen — extracted as a shared component
 * so both screens stay visually consistent (per PromptBook Prompt 7).
 */

import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { RiskFactor } from '../types/navigation';
import { WARNING_AMBER, INTERCEPT_RED, NEUTRAL_LIGHT, NAVY_LIGHT, WHITE } from '../theme/colors';

type Props = {
  factors: RiskFactor[];
  /** 'warning' uses amber accents; 'intercept' uses red accents */
  variant: 'warning' | 'intercept';
  maxHeight?: number;
};

export function RiskFactorList({ factors, variant, maxHeight = 200 }: Props) {
  const accentColor = variant === 'warning' ? WARNING_AMBER : INTERCEPT_RED;

  // Sort descending by points (highest risk first)
  const sorted = [...factors].sort((a, b) => b.points - a.points);

  return (
    <ScrollView
      style={[styles.container, { maxHeight }]}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
    >
      {sorted.map((item, index) => (
        <View key={index} style={styles.row}>
          <View style={[styles.dot, { backgroundColor: accentColor }]} />
          <Text style={styles.factorText} numberOfLines={2}>
            {item.factor}
          </Text>
          <View style={[styles.badge, { backgroundColor: accentColor }]}>
            <Text style={styles.badgeText}>+{item.points} pts</Text>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY_LIGHT,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 10,
    flexShrink: 0,
  },
  factorText: {
    flex: 1,
    color: NEUTRAL_LIGHT,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  badge: {
    marginLeft: 8,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    flexShrink: 0,
  },
  badgeText: {
    color: WHITE,
    fontSize: 11,
    fontWeight: '700',
  },
});
