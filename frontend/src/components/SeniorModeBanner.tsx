/**
 * SeniorModeBanner — Yellow Banner for Senior Citizen Mode
 *
 * Pinned at the top of every screen when isSeniorMode is true.
 * Mounted at the app's root navigator level — NOT duplicated per screen.
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSeniorMode } from '../context/SeniorModeContext';
import { colors, typography, spacing } from '../theme';

export default function SeniorModeBanner() {
  const { isSeniorMode } = useSeniorMode();

  if (!isSeniorMode) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.icon}>👴</Text>
      <Text style={styles.text}>Senior Citizen Mode Active</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.seniorBanner,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  icon: {
    fontSize: 18,
  },
  text: {
    fontSize: typography.bodySmall,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
  },
});
