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
  /** Senior Citizen Mode: hide the numeric "+N pts" badges entirely. */
  hidePoints?: boolean;
  /** Font multiplier (1.5 in Senior Citizen Mode). */
  fontScale?: number;
};

export function RiskFactorList({
  factors,
  variant,
  maxHeight = 200,
  hidePoints = false,
  fontScale = 1,
}: Props) {
  const accentColor = variant === 'warning' ? WARNING_AMBER : INTERCEPT_RED;

  // Sort descending by points (highest risk first)
  const sorted = [...factors].sort((a, b) => b.points - a.points);

  return (
    <ScrollView
      style={[styles.container, { maxHeight: maxHeight * fontScale }]}
      nestedScrollEnabled
      showsVerticalScrollIndicator={false}
      accessibilityRole="list"
      accessibilityLabel="Risk factors, highest first"
    >
      {sorted.map((item, index) => (
        <View
          key={index}
          style={styles.row}
          accessible={true}
          accessibilityRole="text"
          accessibilityLabel={
            hidePoints
              ? item.factor
              : `${item.factor}. Adds ${item.points} risk points.`
          }
        >
          <View style={[styles.dot, { backgroundColor: accentColor }]} />
          <Text
            style={[styles.factorText, { fontSize: Math.round(13 * fontScale), lineHeight: Math.round(18 * fontScale) }]}
            numberOfLines={hidePoints ? 3 : 2}
          >
            {item.factor}
          </Text>
          {!hidePoints && (
            <View style={[styles.badge, { backgroundColor: accentColor }]}>
              <Text style={[styles.badgeText, { fontSize: Math.round(11 * fontScale) }]}>
                +{item.points} pts
              </Text>
            </View>
          )}
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
