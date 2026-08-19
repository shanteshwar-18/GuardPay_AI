/**
 * SettingsScreen — App Settings
 *
 * Contains:
 * - Senior Citizen Mode toggle (persisted to AsyncStorage)
 * - Emergency Contact Number config for one-tap Family Call
 * - Language selection preview
 * - App version & info
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  Switch,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { useSeniorMode } from '../context/SeniorModeContext';
import {
  getEmergencyContact,
  setEmergencyContact,
} from '../components/EmergencyContactButton';
import { colors, typography, spacing, radius } from '../theme';

type SettingsScreenProps = NativeStackScreenProps<RootStackParamList, 'Settings'>;

export default function SettingsScreen({ navigation }: SettingsScreenProps) {
  const { isSeniorMode, toggleSeniorMode } = useSeniorMode();
  const [emergencyPhone, setEmergencyPhone] = useState('');

  useEffect(() => {
    (async () => {
      const contact = await getEmergencyContact();
      if (contact) setEmergencyPhone(contact);
    })();
  }, []);

  const handlePhoneChange = async (text: string) => {
    setEmergencyPhone(text);
    await setEmergencyContact(text);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Text style={styles.backText}>← Back</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Settings</Text>
          <Text style={styles.subtitle}>GuardPay AI Preferences</Text>
        </View>

        {/* Accessibility Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACCESSIBILITY</Text>

          {/* Senior Citizen Mode Toggle */}
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>👴 Senior Citizen Mode</Text>
              <Text style={styles.settingDescription}>
                Larger fonts (1.5×), simplified language, auto-read warnings
                aloud, and emergency family contact button on every screen.
              </Text>
            </View>
            <Switch
              value={isSeniorMode}
              onValueChange={toggleSeniorMode}
              trackColor={{
                false: colors.surfaceLight,
                true: colors.seniorBanner,
              }}
              thumbColor={isSeniorMode ? '#FFFFFF' : colors.textMuted}
            />
          </View>

          {/* Emergency Contact Number Input */}
          <View style={styles.settingCard}>
            <Text style={styles.settingLabel}>📞 Emergency Family Contact</Text>
            <Text style={styles.settingDescription}>
              Phone number dialled when the "Call Family" button is pressed in Senior Mode.
            </Text>
            <TextInput
              style={styles.input}
              value={emergencyPhone}
              onChangeText={handlePhoneChange}
              placeholder="+91 98765 43210 (Default: 112)"
              placeholderTextColor={colors.textMuted}
              keyboardType="phone-pad"
            />
          </View>
        </View>

        {/* Language Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>LANGUAGE & VOICE</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>🔊 Warning Language</Text>
              <Text style={styles.settingDescription}>
                Language used for spoken warnings. Auto-detected from
                conversation when available.
              </Text>
            </View>
            <Text style={styles.settingValue}>English (IN)</Text>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ABOUT</Text>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>🛡️ GuardPay AI</Text>
              <Text style={styles.settingDescription}>
                Real-Time UPI Fraud Intervention Engine{'\n'}
                Version 1.0.0 · Team GuardPay
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  backButton: {
    marginBottom: spacing.md,
  },
  backText: {
    fontSize: typography.body,
    color: colors.primary,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  subtitle: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionTitle: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 1.5,
    marginBottom: spacing.sm,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  settingCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.sm,
  },
  settingInfo: {
    flex: 1,
    marginRight: spacing.md,
  },
  settingLabel: {
    fontSize: typography.body,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  settingDescription: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  settingValue: {
    fontSize: typography.bodySmall,
    color: colors.primary,
    fontWeight: '600',
  },
  input: {
    backgroundColor: colors.surfaceLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
    color: colors.text,
    fontSize: typography.bodySmall,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
