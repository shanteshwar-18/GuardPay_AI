/**
 * GuardPay AI — WarningScreen
 * Shown when Risk Score = 40–70 (WARNING tier).
 * Features: risk gauge, SHAP factor list, multilingual warning, Proceed/Cancel.
 *
 * Per Full Responsibility Matrix: Nikita is primary owner.
 * SHAP explanation rendering — joint ownership with Jatin's backend output.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Animated,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList, RiskFactor } from '../types/navigation';
import { RiskFactorList } from '../components/RiskFactorList';
import { formatINRCompact } from '../services/format';
import { speak } from '../services/tts';
import { useLanguage, toLang } from '../services/languageState';
import { useSeniorMode } from '../context/SeniorModeContext';
import { simplifyExplanation } from '../i18n/simplifiedStrings';
import {
  NAVY,
  NAVY_LIGHT,
  WARNING_AMBER,
  NEUTRAL_GRAY,
  NEUTRAL_LIGHT,
  WHITE,
  ALLOWED_GREEN,
} from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Warning'>;

// Default stub factors shown when no explanation array comes from backend yet
const DEFAULT_EXPLANATION: RiskFactor[] = [
  { factor: 'Voice anomaly detected', points: 25 },
  { factor: 'New beneficiary', points: 15 },
  { factor: 'Urgent language detected', points: 10 },
];

export function WarningScreen({ route, navigation }: Props) {
  const { beneficiary, amount, riskScore, explanation } = route.params;
  const { t } = useTranslation();
  const { currentLanguage } = useLanguage();
  const { isSeniorMode, fontScale, scaleFont: sf } = useSeniorMode();
  const gaugeAnim = useRef(new Animated.Value(0)).current;

  const rawFactors = explanation && explanation.length > 0 ? explanation : DEFAULT_EXPLANATION;

  // Senior Citizen Mode: rewrite raw SHAP factor names in plain language.
  const factors = useMemo(
    () =>
      isSeniorMode
        ? rawFactors.map(f => ({ ...f, factor: simplifyExplanation(f.factor) }))
        : rawFactors,
    [isSeniorMode, rawFactors]
  );

  const safeScore = Math.min(100, Math.max(0, riskScore));

  // Animate gauge fill on mount
  useEffect(() => {
    Animated.timing(gaugeAnim, {
      toValue: safeScore / 100,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [safeScore, gaugeAnim]);

  // Speak warning aloud via TTS stub (Raghav wires real TTS)
  useEffect(() => {
    const msg = t('warning.mainMessage', {
      beneficiary: beneficiary.name,
      amount: formatINRCompact(amount),
    });
    speak(msg, toLang(currentLanguage));
  }, [t, currentLanguage, beneficiary.name, amount]);

  const gaugeWidth = gaugeAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        {/* Header */}
        <Text
          style={[styles.title, { fontSize: sf(22) }]}
          accessibilityRole="header"
        >
          {t('warning.title')}
        </Text>

        {/* Risk Meter.
            Senior Citizen Mode → COLOUR-ONLY: a full amber bar, no numbers at
            all. Standard mode → animated gauge with the 0 / score / 100 scale. */}
        <View style={styles.gaugeSection}>
          {isSeniorMode ? (
            <View
              testID="risk-meter-colour-only"
              accessible={true}
              accessibilityRole="image"
              accessibilityLabel={t('warning.riskLevel')}
            >
              <View style={[styles.gaugeTrack, styles.gaugeTrackSenior]}>
                <View style={[styles.gaugeFill, styles.gaugeFillSenior]} />
              </View>
            </View>
          ) : (
            <>
              <View style={styles.gaugeTrack}>
                <Animated.View
                  style={[styles.gaugeFill, { width: gaugeWidth }]}
                  accessibilityLabel={`Risk score: ${safeScore} out of 100`}
                />
              </View>
              <View style={styles.gaugeLabels}>
                <Text style={styles.gaugeLabelLeft}>0</Text>
                <Text style={styles.riskScoreText} testID="risk-score-text">{safeScore}</Text>
                <Text style={styles.gaugeLabelRight}>100</Text>
              </View>
            </>
          )}
          <Text style={[styles.riskBand, { fontSize: sf(12) }]}>{t('warning.riskLevel')}</Text>
        </View>

        {/* Transaction Summary */}
        <View
          style={styles.txnCard}
          accessible={true}
          accessibilityRole="summary"
          accessibilityLabel={`${formatINRCompact(amount)} to ${beneficiary.name}, ${beneficiary.upiId}`}
        >
          <Text style={[styles.txnAmount, { fontSize: sf(28) }]}>{formatINRCompact(amount)}</Text>
          <Text style={[styles.txnPayee, { fontSize: sf(15) }]}>→ {beneficiary.name}</Text>
          <Text style={[styles.txnUpi, { fontSize: sf(12) }]}>{beneficiary.upiId}</Text>
        </View>

        {/* Warning Message (multilingual) */}
        <View style={styles.warningBox} accessible={true} accessibilityRole="alert">
          <Text style={[styles.warningText, { fontSize: sf(14), lineHeight: sf(22) }]}>
            {t('warning.mainMessage', {
              beneficiary: beneficiary.name,
              amount: formatINRCompact(amount),
            })}
          </Text>
        </View>

        {/* SHAP Factor Breakdown */}
        <Text
          style={[styles.factorsTitle, { fontSize: sf(15) }]}
          accessibilityRole="header"
        >
          {t('warning.factorsTitle')}
        </Text>
        <RiskFactorList
          factors={factors}
          variant="warning"
          maxHeight={220}
          hidePoints={isSeniorMode}
          fontScale={fontScale}
        />

        {/* Action Buttons */}
        <View style={styles.btnRow}>
          <TouchableOpacity
            testID="cancel-btn"
            style={styles.cancelBtn}
            onPress={() => navigation.navigate('Home')}
            activeOpacity={0.85}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('warning.cancel')}
            accessibilityHint="Stops this payment and returns to the home screen. Recommended."
          >
            <Text style={[styles.cancelBtnText, { fontSize: sf(15) }]}>{t('warning.cancel')}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="proceed-btn"
            style={styles.proceedBtn}
            // Legacy route: Pin now takes a RiskTierId and mints/expects a session id.
            onPress={() => navigation.navigate('Pin', {
              sessionId: '', beneficiary, amount, riskScore, tier: 'WARNING',
            })}
            activeOpacity={0.85}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel={t('warning.proceed')}
            accessibilityHint={`Ignores the fraud warning and continues to pay ${formatINRCompact(amount)} to ${beneficiary.name}`}
          >
            <Text style={[styles.proceedBtnText, { fontSize: sf(15) }]}>{t('warning.proceed')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  content: { padding: 22, paddingBottom: 40 },
  title: { color: WARNING_AMBER, fontSize: 22, fontWeight: '800', marginBottom: 22, textAlign: 'center' },
  gaugeSection: { marginBottom: 20 },
  gaugeTrack: {
    height: 14,
    backgroundColor: NAVY_LIGHT,
    borderRadius: 7,
    overflow: 'hidden',
    marginBottom: 8,
  },
  gaugeFill: {
    height: '100%',
    backgroundColor: WARNING_AMBER,
    borderRadius: 7,
  },
  // Senior Citizen Mode — colour-only meter: taller bar, always full, no digits
  gaugeTrackSenior: { height: 28, borderRadius: 14, marginBottom: 10 },
  gaugeFillSenior: { width: '100%', borderRadius: 14 },
  gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  gaugeLabelLeft: { color: NEUTRAL_GRAY, fontSize: 11 },
  gaugeLabelRight: { color: NEUTRAL_GRAY, fontSize: 11 },
  riskScoreText: { color: WARNING_AMBER, fontSize: 28, fontWeight: '900' },
  riskBand: { color: WARNING_AMBER, fontSize: 12, textAlign: 'center', marginTop: 4, letterSpacing: 1 },
  txnCard: {
    backgroundColor: NAVY_LIGHT,
    borderRadius: 14,
    padding: 16,
    alignItems: 'center',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: WARNING_AMBER,
  },
  txnAmount: { color: WHITE, fontSize: 28, fontWeight: '800' },
  txnPayee: { color: NEUTRAL_LIGHT, fontSize: 15, marginTop: 4 },
  txnUpi: { color: NEUTRAL_GRAY, fontSize: 12, marginTop: 2 },
  warningBox: {
    backgroundColor: 'rgba(255,143,0,0.1)',
    borderRadius: 12,
    padding: 14,
    borderLeftWidth: 3,
    borderLeftColor: WARNING_AMBER,
    marginBottom: 20,
  },
  warningText: { color: NEUTRAL_LIGHT, fontSize: 14, lineHeight: 22 },
  factorsTitle: { color: WHITE, fontSize: 15, fontWeight: '700', marginBottom: 10 },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1,
    backgroundColor: NAVY_LIGHT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: NEUTRAL_GRAY,
  },
  cancelBtnText: { color: NEUTRAL_LIGHT, fontSize: 15, fontWeight: '600' },
  proceedBtn: {
    flex: 1.4,
    backgroundColor: WARNING_AMBER,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
  },
  proceedBtnText: { color: NAVY, fontSize: 15, fontWeight: '700' },
});
