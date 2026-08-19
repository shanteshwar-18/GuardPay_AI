/**
 * HoldScreen — Risk Tier: ADAPTIVE_HOLD (score 70–90)
 *
 * Red-tinted screen with:
 * - 30-second countdown timer (auto-cancels when it hits 0)
 * - Step-up verification (4-digit OTP via shared NumericInput)
 * - Risk gauge + explanation list (reused from Prompt 2)
 * - Evidence capture notice
 *
 * Timer cleans up on unmount — no setState-on-unmounted warnings.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { RiskScoreResponse } from '../types';
import {
  colors,
  typography,
  spacing,
  radius,
  TIER_COLORS,
  TIER_BG,
} from '../theme';
import RiskGauge from '../components/RiskGauge';
import ExplanationList from '../components/ExplanationList';
import NumericInput from '../components/NumericInput';
import TTSControl from '../components/TTSControl';
import { warn, stopSpeech, SupportedLanguage } from '../services/tts';

// MOCK — remove once RiskEvalScreen wiring lands
const MOCK_RISK_RESPONSE: RiskScoreResponse = {
  score: 78,
  tier: 'ADAPTIVE_HOLD',
  explanation: [
    'Voice anomaly detected: +25 pts',
    'Coercive language patterns: +20 pts',
    'New beneficiary (first-time payee): +15 pts',
    'Device behaviour anomaly: +18 pts',
  ],
  factors: {
    audio: 0.8,
    text: 0.7,
    new_beneficiary: 1.0,
    reputation: 0.3,
    ocr: 0.0,
    device: 0.6,
  },
  evidence_bundle_id: 'evt_demo_001',
};

const HOLD_DURATION_SECONDS = 30;

interface HoldScreenProps {
  riskResponse?: RiskScoreResponse;
  onTimerExpired?: () => void;
  onVerified?: () => void;
  /** Detected language for TTS — defaults to EN */
  detectedLanguage?: SupportedLanguage;
}

export default function HoldScreen({
  riskResponse = MOCK_RISK_RESPONSE,
  onTimerExpired,
  onVerified,
  detectedLanguage = 'EN',
}: HoldScreenProps) {
  const [secondsLeft, setSecondsLeft] = useState(HOLD_DURATION_SECONDS);
  const [isVerified, setIsVerified] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // TTS: speak warning aloud on mount (Prompt 5)
  const warningText = riskResponse.explanation.join('. ');
  useEffect(() => {
    warn(warningText, detectedLanguage);
    return () => {
      stopSpeech();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Countdown timer — cleans up on unmount
  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Handle timer expiry
  useEffect(() => {
    if (secondsLeft === 0 && !isVerified) {
      Alert.alert(
        'Transaction Cancelled',
        'Cooling-off period expired. Returning to home.',
        [{ text: 'OK', onPress: onTimerExpired }]
      );
    }
  }, [secondsLeft, isVerified, onTimerExpired]);

  // Handle OTP verification
  const handleOTPComplete = (otp: string) => {
    // Accept any 4-digit OTP for hackathon demo
    if (intervalRef.current) clearInterval(intervalRef.current);
    setIsVerified(true);
    Alert.alert(
      'Verification Successful',
      'You may now proceed to enter your PIN.',
      [{ text: 'Continue', onPress: onVerified }]
    );
  };

  const tierColor = TIER_COLORS.ADAPTIVE_HOLD;
  const progress = secondsLeft / HOLD_DURATION_SECONDS;

  return (
    <View style={styles.container}>
      {/* TTS Mute/Replay Control (top-right) */}
      <TTSControl text={warningText} lang={detectedLanguage} />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerIcon}>🛑</Text>
          <Text style={styles.title}>Transaction Held</Text>
          <Text style={styles.subtitle}>
            Elevated risk detected — cooling-off period active
          </Text>
        </View>

        {/* Countdown Timer */}
        <View style={[styles.timerCard, { borderColor: tierColor + '60' }]}>
          <Text style={styles.timerLabel}>COOLING-OFF PERIOD</Text>
          <Text style={[styles.timerValue, { color: tierColor }]}>
            {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
            {String(secondsLeft % 60).padStart(2, '0')}
          </Text>
          {/* Progress bar */}
          <View style={styles.timerBar}>
            <View
              style={[
                styles.timerBarFill,
                {
                  width: `${progress * 100}%`,
                  backgroundColor: tierColor,
                },
              ]}
            />
          </View>
          <Text style={styles.timerNote}>
            {secondsLeft > 0
              ? 'Please wait or verify your identity to proceed'
              : 'Time expired — transaction cancelled'}
          </Text>
        </View>

        {/* Risk Gauge */}
        <View style={[styles.riskCard, { borderColor: tierColor + '30' }]}>
          <RiskGauge
            score={riskResponse.score}
            tier={riskResponse.tier}
            size={100}
          />
        </View>

        {/* Explanation List */}
        <ExplanationList
          explanations={riskResponse.explanation}
          tier={riskResponse.tier}
        />

        {/* Step-Up Verification */}
        <View style={styles.verifySection}>
          <Text style={styles.verifySectionTitle}>Step-Up Verification</Text>
          <Text style={styles.verifySectionSubtitle}>
            Enter the 4-digit verification code to proceed
          </Text>
          <NumericInput
            length={4}
            onComplete={handleOTPComplete}
            dotColor={tierColor}
            disabled={secondsLeft === 0}
          />
        </View>

        {/* Evidence Notice */}
        <View style={styles.evidenceNotice}>
          <Text style={styles.evidenceIcon}>🔒</Text>
          <Text style={styles.evidenceText}>
            An encrypted evidence record of this transaction is being created
            for your protection.
          </Text>
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
    alignItems: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  headerIcon: {
    fontSize: 48,
    marginBottom: spacing.sm,
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
  },
  timerCard: {
    backgroundColor: TIER_BG.ADAPTIVE_HOLD,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  timerLabel: {
    fontSize: typography.caption,
    fontWeight: '700',
    color: colors.textSecondary,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  timerValue: {
    fontSize: 56,
    fontWeight: 'bold',
    fontVariant: ['tabular-nums'],
    marginBottom: spacing.sm,
  },
  timerBar: {
    width: '100%',
    height: 4,
    backgroundColor: colors.surfaceLight,
    borderRadius: 2,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  timerBarFill: {
    height: '100%',
    borderRadius: 2,
  },
  timerNote: {
    fontSize: typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
  },
  riskCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    width: '100%',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  verifySection: {
    width: '100%',
    alignItems: 'center',
    marginTop: spacing.lg,
    marginBottom: spacing.lg,
  },
  verifySectionTitle: {
    fontSize: typography.h3,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
  },
  verifySectionSubtitle: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  evidenceNotice: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.xl,
  },
  evidenceIcon: {
    fontSize: 20,
    marginRight: spacing.sm,
  },
  evidenceText: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    flex: 1,
    lineHeight: 18,
  },
});
