/**
 * InterceptScreen — Risk Tier: HARD_INTERCEPT (score > 90)
 *
 * Full-screen red lock state:
 * - Animated lock icon (scale-pulse loop via React Native Animated API)
 * - "Payment Blocked. Trusted contact has been notified."
 * - Risk score + top explanation factor
 * - Live status line polling GET /api/v1/session/{txn_id}/status
 *   (stubbed with mock cycle: CALLING → AWAITING_RESPONSE → FROZEN)
 * - Only Cancel button — NO path back to PIN/Amount/Beneficiary screens
 * - Polling stops on unmount and once status reaches FROZEN
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
} from 'react-native';
import { RiskScoreResponse, SessionStatus } from '../types';
import { colors, typography, spacing, radius, TIER_COLORS } from '../theme';
import { getSessionStatus } from '../services/api';


/** Status display messages */
const STATUS_MESSAGES: Record<SessionStatus, string> = {
  CALLING: '📞 Trusted contact call in progress…',
  AWAITING_RESPONSE: '⏳ Waiting for trusted contact response…',
  FROZEN: '🔒 Transaction frozen. Bank has been alerted.',
};

// Fallback mock cycle if backend is unreachable (debug flag)
const FALLBACK_STATUS_CYCLE: SessionStatus[] = [
  'CALLING', 'CALLING', 'AWAITING_RESPONSE',
  'AWAITING_RESPONSE', 'AWAITING_RESPONSE', 'FROZEN',
];

interface InterceptScreenProps {
  riskResponse: RiskScoreResponse;
  onCancel?: () => void;
  /** Transaction ID for status polling */
  transactionId?: string;
}

export default function InterceptScreen({
  riskResponse,
  onCancel,
  transactionId,
}: InterceptScreenProps) {
  const [status, setStatus] = useState<SessionStatus>('CALLING');
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const opacityAnim = useRef(new Animated.Value(0.6)).current;
  const pollIndexRef = useRef(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lock icon pulse animation — loops indefinitely
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1.15,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0.6,
            duration: 800,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
      ])
    );

    pulseAnimation.start();

    return () => {
      pulseAnimation.stop();
    };
  }, [scaleAnim, opacityAnim]);

  // Status polling — every 3 seconds
  // Uses real API when transactionId is provided, falls back to mock cycle
  useEffect(() => {
    let fallbackIndex = 0;

    pollIntervalRef.current = setInterval(async () => {
      if (transactionId) {
        // Real API polling
        try {
          const newStatus = await getSessionStatus(transactionId);
          setStatus(newStatus);
          if (newStatus === 'FROZEN' && pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        } catch {
          // API unreachable — fall through to fallback
          if (fallbackIndex < FALLBACK_STATUS_CYCLE.length) {
            const fallbackStatus = FALLBACK_STATUS_CYCLE[fallbackIndex];
            setStatus(fallbackStatus);
            fallbackIndex++;
            if (fallbackStatus === 'FROZEN' && pollIntervalRef.current) {
              clearInterval(pollIntervalRef.current);
            }
          }
        }
      } else {
        // No transactionId — use fallback cycle for demo
        if (fallbackIndex < FALLBACK_STATUS_CYCLE.length) {
          const fallbackStatus = FALLBACK_STATUS_CYCLE[fallbackIndex];
          setStatus(fallbackStatus);
          fallbackIndex++;
          if (fallbackStatus === 'FROZEN' && pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
          }
        }
      }
    }, 3000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [transactionId]);

  const tierColor = TIER_COLORS.HARD_INTERCEPT;
  const topExplanation = riskResponse.explanation[0] || '';

  return (
    <View style={styles.container}>
      {/* Full-screen red background effect */}
      <View style={styles.redOverlay} />

      <View style={styles.content}>
        {/* Animated Lock Icon */}
        <Animated.View
          style={[
            styles.lockContainer,
            {
              transform: [{ scale: scaleAnim }],
              opacity: opacityAnim,
            },
          ]}
        >
          <View style={[styles.lockCircle, { borderColor: tierColor }]}>
            <Text style={styles.lockIcon}>🔒</Text>
          </View>
        </Animated.View>

        {/* Lock Ring Glow */}
        <View style={[styles.glowRing, { borderColor: tierColor + '20' }]} />

        {/* Main Message */}
        <Text style={styles.title}>Payment Blocked</Text>
        <Text style={styles.subtitle}>
          Trusted contact has been notified.
        </Text>

        {/* Risk Score + Top Factor */}
        <View style={styles.infoCard}>
          <View style={styles.scoreRow}>
            <Text style={styles.scoreLabel}>Risk Score</Text>
            <Text style={[styles.scoreValue, { color: tierColor }]}>
              {riskResponse.score}/100
            </Text>
          </View>
          {topExplanation ? (
            <Text style={styles.topFactor}>{topExplanation}</Text>
          ) : null}
        </View>

        {/* Live Status Line */}
        <View
          style={[
            styles.statusCard,
            {
              borderColor:
                status === 'FROZEN' ? colors.success + '40' : tierColor + '40',
            },
          ]}
        >
          <Text
            style={[
              styles.statusText,
              {
                color: status === 'FROZEN' ? colors.success : tierColor,
              },
            ]}
          >
            {STATUS_MESSAGES[status]}
          </Text>
        </View>

        {/* Only Cancel button — NO path to PIN */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={onCancel}
          activeOpacity={0.8}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1A0000',
  },
  redOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: TIER_COLORS.HARD_INTERCEPT + '08',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  lockContainer: {
    marginBottom: spacing.lg,
    zIndex: 2,
  },
  lockCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 3,
    backgroundColor: TIER_COLORS.HARD_INTERCEPT + '15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockIcon: {
    fontSize: 48,
  },
  glowRing: {
    position: 'absolute',
    top: '50%',
    marginTop: -80,
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 20,
    zIndex: 1,
  },
  title: {
    fontSize: typography.h1,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
    textAlign: 'center',
  },
  infoCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.md,
  },
  scoreRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  scoreLabel: {
    fontSize: typography.bodySmall,
    color: colors.textSecondary,
  },
  scoreValue: {
    fontSize: typography.h3,
    fontWeight: 'bold',
  },
  topFactor: {
    fontSize: typography.caption,
    color: colors.textMuted,
    marginTop: spacing.xs,
  },
  statusCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    width: '100%',
    marginBottom: spacing.xl,
  },
  statusText: {
    fontSize: typography.bodySmall,
    fontWeight: '600',
    textAlign: 'center',
  },
  cancelButton: {
    backgroundColor: TIER_COLORS.HARD_INTERCEPT,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xxl,
    borderRadius: radius.md,
    minWidth: 200,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: typography.body,
    fontWeight: '700',
    color: colors.text,
  },
});
