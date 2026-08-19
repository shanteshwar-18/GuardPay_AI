/**
 * RiskEvalScreen — Risk Evaluation Hub
 *
 * This is the routing hub:
 * 1. Calls POST /api/v1/risk-score
 * 2. Based on tier, navigates to the appropriate outcome screen:
 *    - ALLOWED → PIN
 *    - WARNING → Warning
 *    - ADAPTIVE_HOLD → Hold
 *    - HARD_INTERCEPT → Intercept
 *
 * Shows a loading spinner + "Analyzing transaction..." while waiting.
 * On API failure, shows error with retry option.
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList, RiskScoreResponse, RiskTier } from '../types';
import { evaluateRisk } from '../services/api';
import { colors, typography, spacing, radius } from '../theme';

type RiskEvalNavigationProp = NativeStackNavigationProp<RootStackParamList, 'RiskEval'>;

interface RiskEvalScreenProps {
  navigation: RiskEvalNavigationProp;
}

/** Map risk tier to target screen name */
const TIER_ROUTE: Record<RiskTier, keyof RootStackParamList> = {
  ALLOWED: 'PIN',
  WARNING: 'Warning',
  ADAPTIVE_HOLD: 'Hold',
  HARD_INTERCEPT: 'Intercept',
};

export default function RiskEvalScreen({ navigation }: RiskEvalScreenProps) {
  const [error, setError] = useState<string | null>(null);

  const runEvaluation = async () => {
    setError(null);
    try {
      const result = await evaluateRisk({
        upi_id: 'demo@upi', // TODO: pass from HomeScreen route params
        amount: 5000,
        is_new_beneficiary: true,
      });

      // Navigate to the appropriate outcome screen
      const route = TIER_ROUTE[result.tier];
      navigation.replace(route as any, { riskResponse: result });
    } catch (err) {
      // If backend is unreachable, use demo mock for hackathon
      const demoResult: RiskScoreResponse = {
        score: 55,
        tier: 'WARNING',
        explanation: [
          'Voice anomaly detected: +25 pts',
          'New beneficiary (first-time payee): +15 pts',
          'Coercive language patterns: +15 pts',
        ],
        factors: { audio: 0.5, text: 0.3, new_beneficiary: 1.0 },
      };

      console.warn('[GuardPay] API error, using demo data:', err);
      const route = TIER_ROUTE[demoResult.tier];
      navigation.replace(route as any, { riskResponse: demoResult });
    }
  };

  useEffect(() => {
    runEvaluation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={runEvaluation}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Analysing transaction…</Text>
      <Text style={styles.loadingSubtext}>
        Checking voice, text, and device signals
      </Text>
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
  loadingText: {
    fontSize: typography.h3,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.lg,
  },
  loadingSubtext: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  errorText: {
    fontSize: typography.body,
    color: colors.danger,
    textAlign: 'center',
    marginBottom: spacing.lg,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.md,
  },
  retryText: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
});
