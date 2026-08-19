/**
 * SeniorModeBanner — Yellow Top Banner (GuardPayUI)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useSeniorMode } from '../context/SeniorModeContext';

export function SeniorModeBanner() {
  const { isSeniorMode } = useSeniorMode();

  if (!isSeniorMode) return null;

  return (
    <View
      style={styles.banner}
      accessible={true}
      accessibilityRole="alert"
      accessibilityLabel="Senior Citizen Mode is active. Enlarged fonts and voice assistance enabled."
    >
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
    backgroundColor: '#FBBF24',
    paddingVertical: 8,
    paddingHorizontal: 16,
    gap: 8,
    zIndex: 99,
  },
  icon: { fontSize: 18 },
  text: { fontSize: 13, fontWeight: '700', color: '#000000', letterSpacing: 0.5 },
});
