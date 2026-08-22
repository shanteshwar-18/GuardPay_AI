/**
 * GuardPay AI — BeneficiaryScreen
 * UPI ID input with payee name resolution and NEW-payee badge detection.
 *
 * NEW badge logic:
 * - Looks up UPI ID against MOCK_KNOWN_BENEFICIARIES (case-insensitive)
 * - TODO(Section 6 / Shanteshwar): Replace mock check with live call to
 *   backend new-beneficiary endpoint (Bloom filter check).
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { RootStackParamList } from '../types/navigation';
import { MOCK_KNOWN_BENEFICIARIES, MOCK_PAYEE_NAMES } from '../mock/mockData';
import { normaliseUpiId } from '../services/format';
import { useScaledFont } from '../context/SeniorModeContext';
import {
  NAVY,
  NAVY_LIGHT,
  NEUTRAL_GRAY,
  NEUTRAL_LIGHT,
  WHITE,
  WARNING_AMBER,
  ALLOWED_GREEN,
} from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Beneficiary'>;

type ResolvedState = {
  resolved: true;
  name: string;
  isNew: boolean;
} | { resolved: false };

export function BeneficiaryScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const sf = useScaledFont();
  const [upiId, setUpiId] = useState('');
  const [resolvedState, setResolvedState] = useState<ResolvedState>({ resolved: false });

  const handleResolve = useCallback(() => {
    const normalized = normaliseUpiId(upiId);
    if (!normalized || !normalized.includes('@')) return;

    const isKnown = MOCK_KNOWN_BENEFICIARIES.map(normaliseUpiId).includes(normalized);
    // TODO(Section 6 / Shanteshwar): Replace above mock check with:
    //   const isKnown = await api.checkBeneficiary(normalized);

    const name = MOCK_PAYEE_NAMES[normalized] ?? `${upiId.split('@')[0]} (via ${upiId.split('@')[1]})`;

    setResolvedState({ resolved: true, name, isNew: !isKnown });
  }, [upiId]);

  const handleContinue = useCallback(() => {
    if (resolvedState.resolved) {
      navigation.navigate('Amount', {
        beneficiary: {
          upiId,
          name: resolvedState.name,
          isNewBeneficiary: resolvedState.isNew,
        },
      });
    }
  }, [resolvedState, upiId, navigation]);

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text
            style={[styles.heading, { fontSize: sf(26) }]}
            accessibilityRole="header"
          >
            {t('home.sendMoney')}
          </Text>
          <Text style={[styles.subheading, { fontSize: sf(14) }]}>
            {t('beneficiary.inputPlaceholder')}
          </Text>

          {/* UPI ID Input */}
          <View style={styles.inputRow}>
            <TextInput
              testID="upi-id-input"
              style={[styles.input, { fontSize: sf(15) }]}
              placeholder="e.g. name@okaxis"
              placeholderTextColor={NEUTRAL_GRAY}
              value={upiId}
              onChangeText={text => {
                setUpiId(text);
                setResolvedState({ resolved: false });
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onSubmitEditing={handleResolve}
              returnKeyType="done"
              accessible={true}
              accessibilityLabel={t('beneficiary.inputPlaceholder')}
              accessibilityHint="Type the recipient's UPI address, then press Verify"
            />
            <TouchableOpacity
              testID="resolve-btn"
              style={styles.resolveBtn}
              onPress={handleResolve}
              activeOpacity={0.8}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('beneficiary.resolve')}
              accessibilityHint="Looks up the name registered against this UPI ID"
            >
              <Text style={[styles.resolveBtnText, { fontSize: sf(14) }]}>
                {t('beneficiary.resolve')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Resolved Payee Card */}
          {resolvedState.resolved && (
            <View
              testID="resolved-payee-card"
              style={[
                styles.payeeCard,
                resolvedState.isNew && styles.payeeCardNew,
              ]}
              accessible={true}
              accessibilityRole="summary"
              accessibilityLiveRegion="polite"
              accessibilityLabel={
                `Paying ${resolvedState.name}, ${upiId}.` +
                (resolvedState.isNew ? ` ${t('beneficiary.newPayee')}` : '')
              }
            >
              <View style={styles.payeeRow}>
                <View style={styles.payeeAvatar}>
                  <Text style={[styles.payeeAvatarText, { fontSize: sf(20) }]}>
                    {resolvedState.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.payeeInfo}>
                  <Text style={[styles.payeeName, { fontSize: sf(16) }]}>{resolvedState.name}</Text>
                  <Text style={[styles.payeeUpi, { fontSize: sf(12) }]}>{upiId}</Text>
                </View>
                {/* NEW badge — only shown for first-time payees */}
                {resolvedState.isNew && (
                  <View testID="new-badge" style={styles.newBadge}>
                    <Text style={[styles.newBadgeText, { fontSize: sf(11) }]}>
                      {t('badge.new')}
                    </Text>
                  </View>
                )}
              </View>
              {resolvedState.isNew && (
                <Text style={[styles.newWarning, { fontSize: sf(12) }]}>
                  ⚠️ {t('beneficiary.newPayee')}
                </Text>
              )}
            </View>
          )}

          {/* Continue Button */}
          {resolvedState.resolved && (
            <TouchableOpacity
              testID="continue-btn"
              style={styles.continueBtn}
              onPress={handleContinue}
              activeOpacity={0.85}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel={t('beneficiary.continue')}
              accessibilityHint={`Continue to enter the amount to send to ${resolvedState.name}`}
            >
              <Text style={[styles.continueBtnText, { fontSize: sf(17) }]}>
                {t('beneficiary.continue')} →
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  content: { padding: 24, flexGrow: 1 },
  heading: { color: WHITE, fontSize: 26, fontWeight: '800', marginBottom: 6 },
  subheading: { color: NEUTRAL_GRAY, fontSize: 14, marginBottom: 28 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  input: {
    flex: 1,
    backgroundColor: NAVY_LIGHT,
    color: WHITE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#2A3F55',
  },
  resolveBtn: {
    backgroundColor: ALLOWED_GREEN,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
  },
  resolveBtnText: { color: NAVY, fontWeight: '700', fontSize: 14 },
  payeeCard: {
    backgroundColor: NAVY_LIGHT,
    borderRadius: 16,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A3F55',
  },
  payeeCardNew: { borderColor: WARNING_AMBER, borderWidth: 1.5 },
  payeeRow: { flexDirection: 'row', alignItems: 'center' },
  payeeAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1F3044',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  payeeAvatarText: { color: ALLOWED_GREEN, fontSize: 20, fontWeight: '700' },
  payeeInfo: { flex: 1 },
  payeeName: { color: WHITE, fontSize: 16, fontWeight: '700' },
  payeeUpi: { color: NEUTRAL_GRAY, fontSize: 12, marginTop: 2 },
  newBadge: {
    backgroundColor: WARNING_AMBER,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  newBadgeText: { color: NAVY, fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  newWarning: { color: WARNING_AMBER, fontSize: 12, marginTop: 12, lineHeight: 18 },
  continueBtn: {
    backgroundColor: ALLOWED_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  continueBtnText: { color: NAVY, fontSize: 17, fontWeight: '700' },
});
