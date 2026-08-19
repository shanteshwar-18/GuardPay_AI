/**
 * SuccessScreen — Transaction Complete
 *
 * Shows a success confirmation after PIN entry.
 * Navigates back to Home after a delay or on button press.
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { colors, typography, spacing, radius } from '../theme';

type SuccessNavigationProp = NativeStackNavigationProp<RootStackParamList, 'Success'>;

interface SuccessScreenProps {
  navigation: SuccessNavigationProp;
}

export default function SuccessScreen({ navigation }: SuccessScreenProps) {
  // Auto-return to home after 5 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.popToTop();
    }, 5000);
    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <View style={styles.checkCircle}>
        <Text style={styles.checkMark}>✓</Text>
      </View>
      <Text style={styles.title}>Payment Successful!</Text>
      <Text style={styles.subtitle}>Your transaction has been processed safely</Text>
      <TouchableOpacity
        style={styles.homeButton}
        onPress={() => navigation.popToTop()}
        activeOpacity={0.8}
      >
        <Text style={styles.homeButtonText}>Back to Home</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  checkCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.success + '20',
    borderWidth: 3,
    borderColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
  },
  checkMark: {
    fontSize: 48,
    color: colors.success,
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
    textAlign: 'center',
    marginBottom: spacing.xxl,
  },
  homeButton: {
    backgroundColor: colors.success,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.md,
  },
  homeButtonText: {
    fontSize: typography.body,
    fontWeight: '700',
    color: '#000000',
  },
});
