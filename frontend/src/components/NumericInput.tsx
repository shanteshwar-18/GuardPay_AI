/**
 * NumericInput — Shared Numeric Input Component
 *
 * Reusable OTP/PIN-style numeric input pad.
 * Used by PINScreen (6-digit) and HoldScreen (4-digit OTP).
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import { colors, typography, spacing, radius } from '../theme';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

interface NumericInputProps {
  /** Number of digits to accept */
  length: number;
  /** Called when all digits have been entered */
  onComplete: (value: string) => void;
  /** Colour for filled dots */
  dotColor?: string;
  /** Whether the input is disabled */
  disabled?: boolean;
}

export default function NumericInput({
  length,
  onComplete,
  dotColor = colors.primary,
  disabled = false,
}: NumericInputProps) {
  const [value, setValue] = useState('');

  const handleKeyPress = useCallback(
    (key: string) => {
      if (disabled) return;

      if (key === '⌫') {
        setValue((prev) => prev.slice(0, -1));
        return;
      }
      if (key === '' || value.length >= length) return;

      const newValue = value + key;
      setValue(newValue);
      Vibration.vibrate(10);

      if (newValue.length === length) {
        setTimeout(() => onComplete(newValue), 200);
      }
    },
    [value, length, onComplete, disabled]
  );

  return (
    <View style={styles.container}>
      {/* Dots */}
      <View style={styles.dotsContainer}>
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.dot,
              i < value.length && { backgroundColor: dotColor, borderColor: dotColor },
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
              disabled && styles.keyDisabled,
            ]}
            onPress={() => handleKeyPress(key)}
            disabled={key === '' || disabled}
            activeOpacity={0.6}
          >
            <Text
              style={[
                styles.keyText,
                key === '⌫' && styles.keyBackspaceText,
                disabled && styles.keyTextDisabled,
              ]}
            >
              {key}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  dotsContainer: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'transparent',
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    maxWidth: 280,
    gap: spacing.xs,
  },
  key: {
    width: 72,
    height: 56,
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
  keyDisabled: {
    opacity: 0.4,
  },
  keyText: {
    fontSize: typography.h3,
    fontWeight: '600',
    color: colors.text,
  },
  keyBackspaceText: {
    fontSize: typography.body,
    color: colors.textSecondary,
  },
  keyTextDisabled: {
    color: colors.textMuted,
  },
});
