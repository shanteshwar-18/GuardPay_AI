/**
 * NumericInput — Shared Numeric Input Component (GuardPayUI)
 * Reusable 4-digit OTP / 6-digit PIN keypad with haptic feedback & full a11y.
 */

import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Vibration } from 'react-native';
import { WHITE, NEUTRAL_LIGHT, PRIMARY_PURPLE } from '../theme/colors';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

interface NumericInputProps {
  length: number;
  onComplete: (value: string) => void;
  dotColor?: string;
  disabled?: boolean;
}

export function NumericInput({
  length,
  onComplete,
  dotColor = PRIMARY_PURPLE,
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
      <View
        style={styles.dotsContainer}
        accessible={true}
        accessibilityRole="text"
        accessibilityLabel={`${value.length} of ${length} digits entered`}
      >
        {Array.from({ length }).map((_, i) => (
          <View
            key={i}
            accessible={true}
            accessibilityRole="none"
            accessibilityLabel={`Digit ${i + 1}: ${i < value.length ? 'filled' : 'empty'}`}
            style={[
              styles.dot,
              i < value.length && { backgroundColor: dotColor, borderColor: dotColor },
            ]}
          />
        ))}
      </View>

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
            accessible={key !== ''}
            accessibilityRole="button"
            accessibilityLabel={key === '⌫' ? 'Backspace' : `Number ${key}`}
            accessibilityHint={key === '⌫' ? 'Deletes the last entered digit' : `Enters number ${key}`}
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
  container: { alignItems: 'center' },
  dotsContainer: { flexDirection: 'row', gap: 16, marginBottom: 24 },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: '#303050',
    backgroundColor: 'transparent',
  },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', maxWidth: 280, gap: 6 },
  key: {
    width: 72,
    height: 56,
    borderRadius: 12,
    backgroundColor: '#1E1E38',
    alignItems: 'center',
    justifyContent: 'center',
    margin: 4,
  },
  keyEmpty: { backgroundColor: 'transparent' },
  keyBackspace: { backgroundColor: '#2A2A4A' },
  keyDisabled: { opacity: 0.4 },
  keyText: { fontSize: 20, fontWeight: '600', color: WHITE },
  keyBackspaceText: { fontSize: 16, color: NEUTRAL_LIGHT },
  keyTextDisabled: { color: '#6A6A8A' },
});
