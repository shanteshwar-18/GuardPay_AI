/**
 * EmergencyContactButton — One-Tap Family Call
 *
 * Persistent, large, high-contrast button visible on every screen
 * when isSeniorMode is true. Mounted at root navigator level
 * alongside SeniorModeBanner.
 *
 * On tap: calls the stored trusted_contact_number via Linking.openURL.
 * Number is read from AsyncStorage key 'guardpay:emergencyContact'.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  Linking,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSeniorMode } from '../context/SeniorModeContext';
import { colors, typography, spacing, radius } from '../theme';

const EMERGENCY_CONTACT_KEY = 'guardpay:emergencyContact';
const DEFAULT_EMERGENCY_NUMBER = '112'; // India emergency number fallback

export default function EmergencyContactButton() {
  const { isSeniorMode } = useSeniorMode();
  const [contactNumber, setContactNumber] = useState<string | null>(null);

  // Load stored emergency contact
  useEffect(() => {
    (async () => {
      try {
        const stored = await AsyncStorage.getItem(EMERGENCY_CONTACT_KEY);
        setContactNumber(stored);
      } catch {
        // Ignore — will use default
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
        Alert.alert(
          'Unable to Call',
          `Cannot open phone dialler. Please call ${number} manually.`
        );
      }
    } catch (error) {
      Alert.alert('Call Error', 'Failed to initiate the call. Please try again.');
    }
  }, [contactNumber]);

  if (!isSeniorMode) return null;

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      <Text style={styles.icon}>📞</Text>
      <Text style={styles.label}>Call Family</Text>
    </TouchableOpacity>
  );
}

/**
 * Save emergency contact number to AsyncStorage.
 * Called from SettingsScreen.
 */
export async function setEmergencyContact(number: string): Promise<void> {
  try {
    await AsyncStorage.setItem(EMERGENCY_CONTACT_KEY, number);
  } catch (error) {
    console.warn('[GuardPay] Failed to save emergency contact:', error);
  }
}

/**
 * Get stored emergency contact number.
 */
export async function getEmergencyContact(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(EMERGENCY_CONTACT_KEY);
  } catch {
    return null;
  }
}

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    bottom: spacing.xl,
    right: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#DC2626',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.full,
    gap: spacing.sm,
    elevation: 8,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    zIndex: 100,
  },
  icon: {
    fontSize: 22,
  },
  label: {
    fontSize: typography.body,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});
