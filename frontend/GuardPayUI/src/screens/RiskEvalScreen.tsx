/**
 * GuardPay AI — RiskEvalScreen
 * Animated loading state while risk is being evaluated.
 *
 * SECTION 3 (current): Uses a 1.5s placeholder timeout → always routes to Pin (ALLOWED).
 * TODO(Section 6): Replace the setTimeout below with a real POST /api/v1/risk-score call
 * and tier-based routing. See PromptBook Prompt 9 for the exact implementation.
 */

import React, { useEffect, useRef } from 'react';
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
import { RootStackParamList } from '../types/navigation';
import { formatINRCompact } from '../services/format';
import { NAVY, NAVY_LIGHT, NEUTRAL_GRAY, NEUTRAL_LIGHT, WHITE, ALLOWED_GREEN } from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'RiskEval'>;

export function RiskEvalScreen({ route, navigation }: Props) {
  const { beneficiary, amount } = route.params;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // Spinning ring animation
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
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // ─── TODO(Section 6): Replace this placeholder with real API call ──────────
  // import axios from 'axios';
  // import { API_BASE_URL, API_TIMEOUT_MS } from '../services/config';
  // import { startAudioStream, stopAudioStream } from '../services/audioStream';
  //
  // On mount:
  //   const sessionId = uuid();
  //   startAudioStream(sessionId);
  //   try {
  //     const { data } = await axios.post(`${API_BASE_URL}/api/v1/risk-score`, {
  //       upi_id: beneficiary.upiId, amount, is_new_beneficiary: beneficiary.isNewBeneficiary,
  //       audio_buffer_b64: null, ocr_text: null, device_signals: {},
  //     }, { timeout: API_TIMEOUT_MS });
  //     stopAudioStream();
  //     routeByTier(data.tier, data);
  //   } catch {
  //     stopAudioStream();
  //     navigation.navigate('Warning', { ..., riskScore: 50, tier: 'WARNING',
  //       explanation: [{ factor: 'Evaluation unavailable', points: 0 }] });
  //   }
  // ──────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.navigate('Pin', {
        beneficiary,
        amount,
        riskScore: 20,
        tier: 'ALLOWED',
        explanation: [],
      });
    }, 1500);
    return () => clearTimeout(timer);
  }, [navigation, beneficiary, amount]);

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
          Analysing voice, beneficiary & behaviour signals
        </Text>

        {/* Transaction summary */}
        <View style={styles.summaryCard} testID="summary-card">
          <Text style={styles.summaryLabel}>Transaction</Text>
          <Text style={styles.summaryAmount}>{formatINRCompact(amount)}</Text>
          <Text style={styles.summaryPayee}>to {beneficiary.name}</Text>
          <Text style={styles.summaryUpi}>{beneficiary.upiId}</Text>
        </View>

        {/* AI signals row */}
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
  safe: { flex: 1, backgroundColor: NAVY },
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  spinnerContainer: { width: 100, height: 100, alignItems: 'center', justifyContent: 'center', marginBottom: 28 },
  ring: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
    borderColor: ALLOWED_GREEN,
    borderTopColor: 'transparent',
  },
  shieldIcon: { alignItems: 'center', justifyContent: 'center' },
  shieldEmoji: { fontSize: 38 },
  title: { color: WHITE, fontSize: 22, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  subtitle: { color: NEUTRAL_GRAY, fontSize: 13, textAlign: 'center', lineHeight: 20, marginBottom: 32 },
  summaryCard: {
    backgroundColor: NAVY_LIGHT,
    borderRadius: 16,
    padding: 20,
    width: '100%',
    alignItems: 'center',
    marginBottom: 24,
  },
  summaryLabel: { color: NEUTRAL_GRAY, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  summaryAmount: { color: ALLOWED_GREEN, fontSize: 32, fontWeight: '800', letterSpacing: -0.5 },
  summaryPayee: { color: WHITE, fontSize: 15, fontWeight: '600', marginTop: 6 },
  summaryUpi: { color: NEUTRAL_GRAY, fontSize: 12, marginTop: 2 },
  signalsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', justifyContent: 'center' },
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
