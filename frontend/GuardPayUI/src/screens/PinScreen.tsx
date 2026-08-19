/**
 * GuardPay AI — PinScreen
 * Standard frictionless UPI PIN pad. Shown only when Risk < 40 (ALLOWED tier).
 * No risk information or friction shown here.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types/navigation';
import { formatINRCompact } from '../services/format';
import { NAVY, NAVY_LIGHT, ALLOWED_GREEN, NEUTRAL_GRAY, WHITE } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Pin'>;

const PIN_LENGTH = 6;
const KEYPAD = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['', '0', '⌫'],
];

export function PinScreen({ route, navigation }: Props) {
  const { beneficiary, amount } = route.params;
  const [pin, setPin] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const handleKey = (key: string) => {
    if (key === '⌫') {
      setPin(p => p.slice(0, -1));
    } else if (key === '') {
      return;
    } else if (pin.length < PIN_LENGTH) {
      const newPin = pin + key;
      setPin(newPin);
      if (newPin.length === PIN_LENGTH) {
        // Simulate PIN verification success after short delay
        setTimeout(() => {
          setShowSuccess(true);
          setTimeout(() => navigation.navigate('Home'), 1500);
        }, 300);
      }
    }
  };

  if (showSuccess) {
    return (
      <SafeAreaView style={[styles.safe, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 60 }}>✅</Text>
        <Text style={styles.successText}>Payment Successful!</Text>
        <Text style={styles.successAmount}>{formatINRCompact(amount)}</Text>
        <Text style={styles.successPayee}>sent to {beneficiary.name}</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />

      {/* Summary */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>Enter UPI PIN</Text>
        <Text style={styles.headerAmount}>{formatINRCompact(amount)}</Text>
        <Text style={styles.headerPayee}>to {beneficiary.name}</Text>
      </View>

      {/* PIN dots */}
      <View style={styles.dotsRow}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View
            key={i}
            testID={`pin-dot-${i}`}
            style={[styles.dot, i < pin.length && styles.dotFilled]}
          />
        ))}
      </View>

      {/* Keypad */}
      <View style={styles.keypad}>
        {KEYPAD.map((row, ri) => (
          <View key={ri} style={styles.keypadRow}>
            {row.map((key, ki) => (
              <TouchableOpacity
                key={ki}
                testID={key ? `key-${key}` : undefined}
                style={[styles.keyBtn, key === '' && styles.keyBtnEmpty]}
                onPress={() => handleKey(key)}
                activeOpacity={0.7}
                disabled={key === ''}
              >
                <Text style={styles.keyText}>{key}</Text>
              </TouchableOpacity>
            ))}
          </View>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  header: { alignItems: 'center', paddingTop: 40, paddingBottom: 28 },
  headerLabel: { color: NEUTRAL_GRAY, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  headerAmount: { color: ALLOWED_GREEN, fontSize: 34, fontWeight: '800' },
  headerPayee: { color: WHITE, fontSize: 15, marginTop: 4 },
  dotsRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginBottom: 36 },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: NEUTRAL_GRAY },
  dotFilled: { backgroundColor: ALLOWED_GREEN, borderColor: ALLOWED_GREEN },
  keypad: { paddingHorizontal: 40 },
  keypadRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  keyBtn: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: NAVY_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyBtnEmpty: { backgroundColor: 'transparent' },
  keyText: { color: WHITE, fontSize: 22, fontWeight: '600' },
  successText: { color: ALLOWED_GREEN, fontSize: 26, fontWeight: '800', marginTop: 20 },
  successAmount: { color: WHITE, fontSize: 22, fontWeight: '700', marginTop: 10 },
  successPayee: { color: NEUTRAL_GRAY, fontSize: 14, marginTop: 6 },
});
