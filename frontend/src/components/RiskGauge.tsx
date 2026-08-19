/**
 * RiskGauge — Circular Risk Score Visualisation
 *
 * Renders a circular gauge filled proportionally to the score (0–100).
 * Colour matches the risk tier. Used by WarningScreen and HoldScreen.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { RiskTier } from '../types';
import { TIER_COLORS, colors, typography, radius } from '../theme';

interface RiskGaugeProps {
  score: number;
  tier: RiskTier;
  size?: number;
  /** When true (Senior Citizen Mode), shows colour only — no numeric score */
  hideNumber?: boolean;
}

export default function RiskGauge({
  score,
  tier,
  size = 120,
  hideNumber = false,
}: RiskGaugeProps) {
  const tierColor = TIER_COLORS[tier];
  const fillPercent = Math.min(Math.max(score, 0), 100);

  return (
    <View
      style={[styles.container, { width: size, height: size }]}
      accessible={true}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: score }}
      accessibilityLabel={`Risk score: ${score} out of 100, risk category: ${tier}`}
      accessibilityHint="Visual fraud risk assessment from multi-modal analysis"
    >
      {/* Background ring */}
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: tierColor + '30',
          },
        ]}
      />
      {/* Filled portion (clipped from bottom) */}
      <View
        style={[
          styles.fillWrapper,
          {
            width: size,
            height: size,
          },
        ]}
      >
        <View
          style={[
            styles.fill,
            {
              width: size - 8,
              height: ((size - 8) * fillPercent) / 100,
              backgroundColor: tierColor + '25',
              borderBottomLeftRadius: (size - 8) / 2,
              borderBottomRightRadius: (size - 8) / 2,
              borderTopLeftRadius: fillPercent > 90 ? (size - 8) / 2 : 0,
              borderTopRightRadius: fillPercent > 90 ? (size - 8) / 2 : 0,
            },
          ]}
        />
      </View>
      {/* Centre content */}
      <View style={[styles.center, { width: size, height: size }]}>
        {hideNumber ? (
          <View
            style={[
              styles.trafficLight,
              { backgroundColor: tierColor, width: size * 0.3, height: size * 0.3, borderRadius: (size * 0.3) / 2 },
            ]}
          />
        ) : (
          <>
            <Text style={[styles.score, { color: tierColor, fontSize: size * 0.3 }]}>
              {score}
            </Text>
            <Text style={[styles.label, { fontSize: size * 0.1 }]}>RISK</Text>
          </>
        )}
      </View>
      {/* Outer glow ring */}
      <View
        style={[
          styles.glowRing,
          {
            width: size + 4,
            height: size + 4,
            borderRadius: (size + 4) / 2,
            borderColor: tierColor + '15',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    borderWidth: 4,
  },
  fillWrapper: {
    position: 'absolute',
    overflow: 'hidden',
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  fill: {
    position: 'absolute',
    bottom: 4,
    alignSelf: 'center',
  },
  center: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  score: {
    fontWeight: 'bold',
  },
  label: {
    color: colors.textSecondary,
    fontWeight: '600',
    letterSpacing: 2,
  },
  trafficLight: {
    // Senior mode: simple colour circle
  },
  glowRing: {
    position: 'absolute',
    borderWidth: 1,
  },
});
