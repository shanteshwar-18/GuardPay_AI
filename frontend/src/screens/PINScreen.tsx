/**
 * PINScreen — Risk Tier: ALLOWED (score < 40)
 *
 * Standard UPI 6-digit PIN pad with zero added friction.
 * No risk messaging, no warnings — the point of this screen
 * is that the transaction is safe and proceeds normally.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Vibration,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, typography, spacing, radius, TIER_COLORS } from '../theme';

type PINScreenProps = NativeStackScreenProps<RootStackParamList, 'PIN'>;

const PIN_LENGTH = 6;
const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function PINScreen({ route, navigation }: PINScreenProps) {
  const { riskResponse } = route.params;
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);

  const handleKeyPress = (key: string) => {
    if (key === '⌫') {
      setPin((prev) => prev.slice(0, -1));
      setError(false);
      return;
    }
    if (key === '' || pin.length >= PIN_LENGTH) return;

    const newPin = pin + key;
    setPin(newPin);
    Vibration.vibrate(10);

    if (newPin.length === PIN_LENGTH) {
      // For hackathon demo — accept any 6-digit PIN
      setTimeout(() => {
        navigation.navigate('Success');
      }, 300);
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.safeIndicator}>
          <Text style={styles.safeIcon}>✓</Text>
        </View>
        <Text style={styles.title}>Enter UPI PIN</Text>
        <Text style={styles.subtitle}>Transaction verified — proceed safely</Text>
      </View>

      {/* PIN Dots */}
      <View style={styles.dotsContainer}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < pin.length && styles.dotFilled,
              error && styles.dotError,
            ]}
          />
        ))}
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYS.map((key, index) => (
          <TouchableOpacity
            key={index}
            style={[
              styles.key,
              key === '' && styles.keyEmpty,
              key === '⌫' && styles.keyBackspace,
            ]}
            onPress={() => handleKeyPress(key)}
            disabled={key === ''}
            activeOpacity={0.6}
          >
            <Text
              style={[
                styles.keyText,
                key === '⌫' && styles.keyBackspaceText,
              ]}
            >
              {key}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Cancel */}
      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => navigation.popToTop()}
        activeOpacity={0.7}
      >
        <Text style={styles.cancelText}>Cancel</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xxl,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  safeIndicator: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: TIER_COLORS.ALLOWED + '20',
    borderWidth: 2,
    borderColor: TIER_COLORS.ALLOWED,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  safeIcon: {
    fontSize: 24,
    color: TIER_COLORS.ALLOWED,
    fontWeight: 'bold',
  },
  title: {
    fontSize: typography.h2,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.xl,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: radius.full,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  dotFilled: {
    backgroundColor: TIER_COLORS.ALLOWED,
    borderColor: TIER_COLORS.ALLOWED,
  },
  dotError: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 300,
    gap: spacing.sm,
  },
  key: {
    width: 80,
    height: 64,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    margin: spacing.xs,
  },
  keyEmpty: {
    backgroundColor: 'transparent',
  },
  keyBackspace: {
    backgroundColor: colors.surfaceLight,
  },
  keyText: {
    fontSize: typography.h2,
    fontWeight: '600',
    color: colors.text,
  },
  keyBackspaceText: {
    fontSize: typography.h3,
    color: colors.textSecondary,
  },
  cancelButton: {
    marginTop: spacing.xl,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  cancelText: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
});
