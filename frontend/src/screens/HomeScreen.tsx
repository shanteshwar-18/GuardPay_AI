/**
 * HomeScreen — Landing / Transaction Initiation
 *
 * Simple UPI-style home screen where the user enters:
 * - Beneficiary UPI ID
 * - Amount
 * - Starts the transaction → navigates to RiskEvalScreen
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, typography, spacing, radius } from '../theme';

type HomeScreenNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

interface HomeScreenProps {
  navigation: HomeScreenNavigationProp;
}

export default function HomeScreen({ navigation }: HomeScreenProps) {
  const [upiId, setUpiId] = useState('');
  const [amount, setAmount] = useState('');

  const isValid = upiId.includes('@') && parseFloat(amount) > 0;

  const handlePay = () => {
    navigation.navigate('RiskEval');
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🛡️</Text>
          <Text style={styles.title}>GuardPay</Text>
          <Text style={styles.subtitle}>AI-Protected UPI Payments</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.label}>Beneficiary UPI ID</Text>
          <TextInput
            style={styles.input}
            value={upiId}
            onChangeText={setUpiId}
            placeholder="example@upi"
            placeholderTextColor={colors.textMuted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          <Text style={styles.label}>Amount (₹)</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="0.00"
            placeholderTextColor={colors.textMuted}
            keyboardType="numeric"
          />
        </View>

        {/* Pay Button */}
        <TouchableOpacity
          style={[styles.payButton, !isValid && styles.payButtonDisabled]}
          onPress={handlePay}
          disabled={!isValid}
          activeOpacity={0.8}
        >
          <Text style={styles.payButtonText}>
            {isValid ? `Pay ₹${amount}` : 'Enter Details'}
          </Text>
        </TouchableOpacity>

        {/* Settings Link */}
        <TouchableOpacity
          style={styles.settingsLink}
          onPress={() => navigation.navigate('Settings')}
        >
          <Text style={styles.settingsText}>⚙️ Settings</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    padding: spacing.lg,
    paddingTop: spacing.xxl * 2,
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  logo: {
    fontSize: 56,
    marginBottom: spacing.sm,
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
  form: {
    width: '100%',
    marginBottom: spacing.xl,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: spacing.xs,
    marginTop: spacing.md,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: typography.body,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
  },
  payButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  payButtonDisabled: {
    opacity: 0.4,
  },
  payButtonText: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
  settingsLink: {
    paddingVertical: spacing.md,
  },
  settingsText: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },
});
