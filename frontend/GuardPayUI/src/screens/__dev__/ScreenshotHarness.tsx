/**
 * GuardPay AI — Screenshot Harness (Prompt 13 · Phase 11)
 * Dev-only screen that renders every screen with pre-populated mock params.
 * This route is ONLY registered when __DEV__ is true — never in Release builds.
 *
 * Usage: Navigate to this screen from the Home screen during dev.
 * Then jump directly to any screen in any risk tier without walking the full flow.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { NativeStackScreenProps, createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';

// All screens
import { HomeScreen } from '../HomeScreen';
import { BeneficiaryScreen } from '../BeneficiaryScreen';
import { AmountScreen } from '../AmountScreen';
import { RiskEvalScreen } from '../RiskEvalScreen';
import { PinScreen } from '../PinScreen';
import { WarningScreen } from '../WarningScreen';
import { InterceptScreen } from '../InterceptScreen';
import { HoldScreen } from '../HoldScreen';

import { NAVY, NAVY_LIGHT, ALLOWED_GREEN, WARNING_AMBER, INTERCEPT_RED, HOLD_RED, NEUTRAL_LIGHT, WHITE, NEUTRAL_GRAY } from '../../theme/colors';

// ─── Mock Params ──────────────────────────────────────────────────────────────

const KNOWN_BENEFICIARY = { upiId: 'rahul@okaxis', name: 'Rahul Sharma', isNewBeneficiary: false };
const NEW_BENEFICIARY   = { upiId: 'scammer@ybl', name: 'Unknown Caller', isNewBeneficiary: true };

const SHAP_3 = [
  { factor: 'Voice anomaly detected (CNN)', points: 25 },
  { factor: 'New beneficiary', points: 15 },
  { factor: 'Urgent language detected (Llama 3)', points: 10 },
];

const SHAP_INTERCEPT = [
  { factor: 'Synthetic voice detected (CNN)', points: 38 },
  { factor: 'Coercive language confirmed (Llama 3)', points: 30 },
  { factor: 'Screen-share anomaly detected', points: 20 },
  { factor: 'New beneficiary', points: 15 },
];

type Scenario = {
  label: string;
  color: string;
  emoji: string;
  screen: string;
  params: Record<string, unknown>;
};

const SCENARIOS: Scenario[] = [
  {
    label: '01 — Home (idle)',
    color: ALLOWED_GREEN,
    emoji: '🏠',
    screen: 'Home',
    params: {},
  },
  {
    label: '02 — Beneficiary: Known payee',
    color: ALLOWED_GREEN,
    emoji: '✅',
    screen: 'Beneficiary',
    params: {},
  },
  {
    label: '03 — Beneficiary: NEW payee badge',
    color: WARNING_AMBER,
    emoji: '🆕',
    screen: 'Beneficiary',
    params: {},
  },
  {
    label: '04 — Amount (₹25,000)',
    color: ALLOWED_GREEN,
    emoji: '💰',
    screen: 'Amount',
    params: { beneficiary: NEW_BENEFICIARY },
  },
  {
    label: '05 — RiskEval (loading)',
    color: ALLOWED_GREEN,
    emoji: '🔄',
    screen: 'RiskEval',
    params: { beneficiary: KNOWN_BENEFICIARY, amount: 1500 },
  },
  {
    label: '06 — PIN (ALLOWED, risk=20)',
    color: ALLOWED_GREEN,
    emoji: '🟢',
    screen: 'Pin',
    params: { beneficiary: KNOWN_BENEFICIARY, amount: 1500, riskScore: 20, tier: 'ALLOWED', explanation: [] },
  },
  {
    label: '07 — Warning (risk=58) + SHAP',
    color: WARNING_AMBER,
    emoji: '⚠️',
    screen: 'Warning',
    params: { beneficiary: NEW_BENEFICIARY, amount: 25000, riskScore: 58, tier: 'WARNING', explanation: SHAP_3 },
  },
  {
    label: '08 — Hold (risk=75)',
    color: HOLD_RED,
    emoji: '⏳',
    screen: 'Hold',
    params: { beneficiary: NEW_BENEFICIARY, amount: 25000, riskScore: 75, tier: 'ADAPTIVE_HOLD', explanation: SHAP_3 },
  },
  {
    label: '09 — Intercept (risk=94) LOCK',
    color: INTERCEPT_RED,
    emoji: '🔒',
    screen: 'Intercept',
    params: { beneficiary: NEW_BENEFICIARY, amount: 25000, riskScore: 94, tier: 'HARD_INTERCEPT', explanation: SHAP_INTERCEPT },
  },
  {
    label: '10 — Warning in Hindi (hi)',
    color: WARNING_AMBER,
    emoji: '🇮🇳',
    screen: 'Warning',
    params: { beneficiary: NEW_BENEFICIARY, amount: 25000, riskScore: 62, tier: 'WARNING', explanation: SHAP_3 },
  },
];

// ─── Harness Screen ────────────────────────────────────────────────────────────

export function ScreenshotHarness({ navigation }: { navigation: any }) {
  // Only render in dev mode
  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={styles.prodMessage}>Screenshot Harness is dev-only and not available in production builds.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <Text style={styles.title}>🎬 Screenshot Harness</Text>
      <Text style={styles.subtitle}>Tap any scenario to jump directly to that screen</Text>
      <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
        {SCENARIOS.map((s, i) => (
          <TouchableOpacity
            key={i}
            style={[styles.card, { borderLeftColor: s.color }]}
            onPress={() => navigation.navigate(s.screen, s.params)}
            activeOpacity={0.8}
          >
            <Text style={styles.cardEmoji}>{s.emoji}</Text>
            <View style={styles.cardText}>
              <Text style={styles.cardLabel}>{s.label}</Text>
              <Text style={styles.cardScreen}>→ {s.screen}Screen</Text>
            </View>
          </TouchableOpacity>
        ))}
        <View style={styles.spacer} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  title: { color: WHITE, fontSize: 20, fontWeight: '800', paddingHorizontal: 20, paddingTop: 18, marginBottom: 4 },
  subtitle: { color: NEUTRAL_GRAY, fontSize: 12, paddingHorizontal: 20, marginBottom: 16 },
  list: { paddingHorizontal: 16, paddingBottom: 32 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY_LIGHT,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderLeftWidth: 4,
  },
  cardEmoji: { fontSize: 22, marginRight: 14 },
  cardText: { flex: 1 },
  cardLabel: { color: NEUTRAL_LIGHT, fontSize: 13, fontWeight: '700' },
  cardScreen: { color: NEUTRAL_GRAY, fontSize: 11, marginTop: 2 },
  prodMessage: { color: WHITE, fontSize: 14, padding: 24, textAlign: 'center' },
  spacer: { height: 40 },
});
