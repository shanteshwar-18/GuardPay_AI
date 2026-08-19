/**
 * EmergencyContactButton — One-Tap Family Call FAB (GuardPayUI)
 */

import React, { useState, useEffect, useCallback } from 'react';
import { TouchableOpacity, Text, StyleSheet, Linking, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSeniorMode } from '../context/SeniorModeContext';

const EMERGENCY_CONTACT_KEY = 'guardpay:emergencyContact';
const DEFAULT_EMERGENCY_NUMBER = '112';

export function EmergencyContactButton() {
  const { isSeniorMode } = useSeniorMode();
  const [contactNumber, setContactNumber] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(EMERGENCY_CONTACT_KEY);
        setContactNumber(stored);
      } catch {
        // ignore
      }
    })();
  }, []);

  const handlePress = useCallback(async () => {
    const number = contactNumber || DEFAULT_EMERGENCY_NUMBER;
    const url = `tel:${number}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Unable to Call', `Please call ${number} manually.`);
      }
    } catch {
      Alert.alert('Call Error', 'Failed to initiate call.');
    }
  }, [contactNumber]);

  if (!isSeniorMode) return null;

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      activeOpacity={0.8}
      accessible={true}
      accessibilityRole="button"
      accessibilityLabel={`Call emergency family contact ${contactNumber || '112'}`}
      accessibilityHint="Directly dials your configured emergency family contact number"
    >
      <Text style={styles.icon}>📞</Text>
      <Text style={styles.label}>Call Family</Text>
    </TouchableOpacity>
  );
}

export async function setEmergencyContact(number: string): Promise<void> {
  await AsyncStorage.setItem(EMERGENCY_CONTACT_KEY, number);
}

export async function getEmergencyContact(): Promise<string | null> {
  return await AsyncStorage.getItem(EMERGENCY_CONTACT_KEY);
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: 32,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 9999,
    gap: 8,
    elevation: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    zIndex: 100,
  },
  icon: { fontSize: 20 },
  label: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
