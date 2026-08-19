/**
 * GuardPay AI — InterceptScreen
 * Shown when Risk Score > 90 (HARD_INTERCEPT tier).
 * Full-screen red lock. NO path back to PIN pad. Back gesture disabled.
 *
 * Per Full Responsibility Matrix: Nikita is primary owner.
 * Polls GET /api/v1/session/{transactionId}/status every 3s for Twilio IVR outcome.
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated,
  BackHandler,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
import { RootStackParamList, RiskFactor } from '../types/navigation';
import { RiskFactorList } from '../components/RiskFactorList';
import { formatINRCompact } from '../services/format';
import { speak } from '../services/tts';
import { useLanguage, toLang } from '../services/languageState';
import { API_BASE_URL, SESSION_POLL_INTERVAL_MS } from '../services/config';
import {
  NAVY,
  NAVY_LIGHT,
  INTERCEPT_RED,
  NEUTRAL_GRAY,
  NEUTRAL_LIGHT,
  WHITE,
} from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Intercept'>;

type SessionStatus = 'waiting' | 'released' | 'frozen';

const DEFAULT_EXPLANATION: RiskFactor[] = [
  { factor: 'Synthetic voice detected (CNN)', points: 38 },
  { factor: 'Coercive language confirmed (Llama 3)', points: 30 },
  { factor: 'Screen-share anomaly detected', points: 20 },
  { factor: 'New beneficiary', points: 15 },
];

export function InterceptScreen({ route, navigation }: Props) {
  const { beneficiary, amount, riskScore, explanation, transactionId } = route.params;
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const [status, setStatus] = useState<SessionStatus>('waiting');

  const factors = explanation && explanation.length > 0 ? explanation : DEFAULT_EXPLANATION;

  // ─── Disable ALL back navigation (hardware + gesture) ─────────────────────
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => handler.remove();
  }, []);

  // ─── Lock icon pulsing animation ──────────────────────────────────────────
  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.12, duration: 700, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  // ─── TTS: speak intercept message on mount ────────────────────────────────
  useEffect(() => {
    const msg = t('intercept.mainMessage', {
      beneficiary: beneficiary.name,
      amount: formatINRCompact(amount),
    });
    speak(msg, toLang(currentLanguage));
  }, [t, currentLanguage, beneficiary.name, amount]);

  // ─── Session status polling (Twilio IVR outcome) ──────────────────────────
  useEffect(() => {
    if (!transactionId) return;

    const poll = setInterval(async () => {
      try {
        // TODO(Shanteshwar): Confirm endpoint path and response shape
        const { data } = await axios.get(
          `${API_BASE_URL}/api/v1/session/${transactionId}/status`
        );
        if (data?.status === 'RELEASED') setStatus('released');
        else if (data?.status === 'FROZEN') setStatus('frozen');
      } catch {
        // Backend not reachable — keep showing 'waiting', don't crash
      }
    }, SESSION_POLL_INTERVAL_MS);

    return () => clearInterval(poll);
  }, [transactionId]);

  const statusText: Record<SessionStatus, string> = {
    waiting: t('intercept.statusWaiting'),
    released: t('intercept.statusReleased'),
    frozen: t('intercept.statusFrozen'),
  };

  const statusColor: Record<SessionStatus, string> = {
    waiting: NEUTRAL_GRAY,
    released: '#00E676',
    frozen: INTERCEPT_RED,
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={INTERCEPT_RED} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Lock Icon */}
        <Animated.Text
          style={[styles.lockIcon, { transform: [{ scale: pulseAnim }] }]}
          accessibilityLabel={`Risk score: ${riskScore} out of 100 — Hard Intercept`}
        >
          🔒
        </Animated.Text>

        {/* Title */}
        <Text style={styles.title}>{t('intercept.title')}</Text>

        {/* Message */}
        <Text style={styles.message}>
          {t('intercept.mainMessage', {
            beneficiary: beneficiary.name,
            amount: formatINRCompact(amount),
          })}
        </Text>

        {/* Risk Score */}
        <View style={styles.scoreTag}>
          <Text style={styles.scoreLabel}>Risk Score</Text>
          <Text style={styles.scoreValue}>{riskScore} / 100</Text>
        </View>

        {/* Twilio IVR Status */}
        <View style={styles.statusBox}>
          <Text style={styles.statusIcon}>📞</Text>
          <Text style={[styles.statusText, { color: statusColor[status] }]}>
            {statusText[status]}
          </Text>
        </View>

        {/* SHAP Factor List (compact, shared component) */}
        <Text style={styles.factorsTitle}>Contributing Risk Factors</Text>
        <RiskFactorList factors={factors} variant="intercept" maxHeight={200} />

        {/* Cancel — the ONLY button. No path to PinScreen. */}
        <TouchableOpacity
          testID="cancel-btn"
          style={styles.cancelBtn}
          onPress={() => navigation.navigate('Home')}
          activeOpacity={0.85}
        >
          <Text style={styles.cancelBtnText}>Cancel Transaction</Text>
        </TouchableOpacity>

        <Text style={styles.footerNote}>
          Your bank has been alerted. Evidence has been securely preserved.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#1A0000' },
  content: { alignItems: 'center', padding: 24, paddingBottom: 48 },
  lockIcon: { fontSize: 80, marginTop: 16, marginBottom: 16 },
  title: { color: WHITE, fontSize: 24, fontWeight: '900', textAlign: 'center', marginBottom: 14 },
  message: {
    color: NEUTRAL_LIGHT,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
    paddingHorizontal: 8,
  },
  scoreTag: {
    backgroundColor: INTERCEPT_RED,
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  scoreLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12, letterSpacing: 1, textTransform: 'uppercase' },
  scoreValue: { color: WHITE, fontSize: 22, fontWeight: '900' },
  statusBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY_LIGHT,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 22,
    width: '100%',
    gap: 10,
  },
  statusIcon: { fontSize: 20 },
  statusText: { fontSize: 14, fontWeight: '600', flex: 1 },
  factorsTitle: { color: WHITE, fontSize: 14, fontWeight: '700', alignSelf: 'flex-start', marginBottom: 8 },
  cancelBtn: {
    marginTop: 28,
    backgroundColor: INTERCEPT_RED,
    borderRadius: 14,
    paddingVertical: 16,
    width: '100%',
    alignItems: 'center',
  },
  cancelBtnText: { color: WHITE, fontSize: 17, fontWeight: '700' },
  footerNote: {
    color: NEUTRAL_GRAY,
    fontSize: 11,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});
