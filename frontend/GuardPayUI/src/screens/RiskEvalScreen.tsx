/**
 * GuardPay AI — RiskEvalScreen (REAL AI Integration)
 *
 * Calls POST /api/v1/risk-score with UPI details + audio buffer,
 * then routes to the correct outcome screen based on risk tier.
 *
 * Tier routing:
 *   ALLOWED         → PinScreen
 *   WARNING         → WarningScreen
 *   ADAPTIVE_HOLD   → HoldScreen
 *   HARD_INTERCEPT  → InterceptScreen
 *
 * Audio: startAudioStream() runs in parallel — WS chunks are sent while
 * the REST call is in-flight. stopAudioStream() is called on any outcome.
 *
 * Commit: feat(integration): wire RiskEvalScreen to real POST /api/v1/risk-score
 * Author: Jatin (AI/ML wiring)
 */

import React, { useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList, RiskTier, RiskFactor } from '../types/navigation';
import { formatINRCompact } from '../services/format';
import {
  NAVY, NAVY_LIGHT, NEUTRAL_GRAY, NEUTRAL_LIGHT, WHITE, ALLOWED_GREEN,
} from '../theme/colors';
import { API_BASE_URL, API_TIMEOUT_MS } from '../services/config';
import { startAudioStream, stopAudioStream } from '../services/audioStream';

type Props = NativeStackScreenProps<RootStackParamList, 'RiskEval'>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Generate a UUID-like session ID (no external dep required). */
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/** Map backend tier string to our RiskTier type (defensive normalise). */
function normaliseTier(raw: string): RiskTier {
  const upper = (raw ?? '').toUpperCase();
  const map: Record<string, RiskTier> = {
    ALLOWED:        'ALLOWED',
    WARNING:        'WARNING',
    ELEVATED:       'WARNING',          // backend uses ELEVATED, frontend uses WARNING
    ADAPTIVE_HOLD:  'ADAPTIVE_HOLD',
    HARD_INTERCEPT: 'HARD_INTERCEPT',
  };
  return map[upper] ?? 'WARNING';
}

/** Map backend explanation[] into our RiskFactor[] shape. */
function normaliseExplanation(raw: unknown): RiskFactor[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    factor: item.factor ?? item.reason ?? 'Unknown',
    points: typeof item.points === 'number' ? item.points : 0,
  }));
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RiskEvalScreen({ route, navigation }: Props) {
  const { beneficiary, amount, note } = route.params;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim   = useRef(new Animated.Value(0)).current;

  // Animations
  useEffect(() => {
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();
  }, [rotateAnim, fadeAnim]);

  const spin = rotateAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ─── Real AI API call ──────────────────────────────────────────────────────
  const routeByTier = useCallback(
    (tier: RiskTier, riskScore: number, explanation: RiskFactor[], transactionId?: string) => {
      const common = { beneficiary, amount, riskScore, tier, explanation, transactionId };
      switch (tier) {
        case 'ALLOWED':
          navigation.navigate('Pin', { ...common });
          break;
        case 'WARNING':
          navigation.navigate('Warning', { ...common });
          break;
        case 'ADAPTIVE_HOLD':
          navigation.navigate('Hold', { ...common });
          break;
        case 'HARD_INTERCEPT':
          navigation.navigate('Intercept', { ...common });
          break;
        default:
          // Defensive: unknown tier → treat as warning
          navigation.navigate('Warning', { ...common, tier: 'WARNING' });
      }
    },
    [navigation, beneficiary, amount]
  );

  useEffect(() => {
    const sessionId = generateSessionId();
    let cancelled = false;

    const run = async () => {
      // ── 1. Start audio streaming in parallel (non-blocking) ──────────────
      try {
        await startAudioStream(sessionId);
      } catch (e) {
        console.warn('[RiskEval] Audio stream failed to start (non-fatal):', e);
      }

      // ── 2. Call the risk score REST endpoint ─────────────────────────────
      try {
        const controller = new AbortController();
        const timeoutId  = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

        const response = await fetch(
          `${API_BASE_URL}/api/v1/risk-score`,
          {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            signal:  controller.signal,
            body: JSON.stringify({
              upi_id:            beneficiary.upiId,
              amount,
              is_new_beneficiary: beneficiary.isNewBeneficiary,
              session_id:         sessionId,
              note:               note ?? null,
              // audio_buffer_b64 intentionally null — chunks arrive via WS
              audio_buffer_b64:   null,
              ocr_text:           null,
              device_signals:     {},
            }),
          }
        );

        clearTimeout(timeoutId);
        if (cancelled) return;

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        stopAudioStream();

        if (cancelled) return;

        const tier        = normaliseTier(data.tier ?? data.risk_tier ?? 'WARNING');
        const riskScore   = typeof data.risk_score === 'number' ? Math.round(data.risk_score) : 50;
        const explanation = normaliseExplanation(data.explanation ?? data.shap_top3 ?? []);
        const txnId       = data.transaction_id ?? data.txn_id ?? sessionId;

        routeByTier(tier, riskScore, explanation, txnId);

      } catch (err: any) {
        stopAudioStream();
        if (cancelled) return;

        // ── 3. Fallback: backend unreachable → safe warning ────────────────
        console.warn('[RiskEval] API call failed — showing fallback warning:', err?.message);
        routeByTier('WARNING', 50, [{ factor: 'AI evaluation temporarily unavailable', points: 0 }]);
      }
    };

    run();

    return () => {
      cancelled = true;
      stopAudioStream();
    };
  }, [beneficiary, amount, note, routeByTier]);

  // ─── UI ───────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
        {/* Animated spinner */}
        <View style={styles.spinnerContainer}>
          <Animated.View style={[styles.ring, { transform: [{ rotate: spin }] }]} />
          <View style={styles.shieldIcon}>
            <Text style={styles.shieldEmoji}>🛡️</Text>
          </View>
        </View>

        <Text style={styles.title} testID="checking-label">
          Checking transaction safety…
        </Text>
        <Text style={styles.subtitle}>
          Analysing voice, beneficiary &amp; behaviour signals
        </Text>

        {/* Transaction summary */}
        <View style={styles.summaryCard} testID="summary-card">
          <Text style={styles.summaryLabel}>Transaction</Text>
          <Text style={styles.summaryAmount}>{formatINRCompact(amount)}</Text>
          <Text style={styles.summaryPayee}>to {beneficiary.name}</Text>
          <Text style={styles.summaryUpi}>{beneficiary.upiId}</Text>
        </View>

        {/* AI signal pills */}
        <View style={styles.signalsRow}>
          {['🎙 Voice', '💬 NLP', '📸 OCR', '📊 DB'].map(sig => (
            <View key={sig} style={styles.signalPill}>
              <Text style={styles.signalText}>{sig}</Text>
            </View>
          ))}
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:             { flex: 1, backgroundColor: NAVY },
  container:        { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  spinnerContainer: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  ring: {
    position: 'absolute',
    width: 100, height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: ALLOWED_GREEN,
    borderTopColor: 'transparent',
  },
  shieldIcon:    { alignItems: 'center', justifyContent: 'center' },
  shieldEmoji:   { fontSize: 38 },
  title:         { color: WHITE, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  subtitle:      { color: NEUTRAL_GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  summaryCard: {
    backgroundColor: NAVY_LIGHT,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryLabel:  { color: NEUTRAL_GRAY, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  summaryAmount: { color: ALLOWED_GREEN, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  summaryPayee:  { color: WHITE, fontSize: 15, fontWeight: '600', marginTop: 6 },
  summaryUpi:    { color: NEUTRAL_GRAY, fontSize: 12, marginTop: 2 },
  signalsRow:    { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
  signalPill: {
    backgroundColor: '#1A2E45',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#2A4060',
  },
  signalText: { color: NEUTRAL_LIGHT, fontSize: 12, fontWeight: '600' },
});
