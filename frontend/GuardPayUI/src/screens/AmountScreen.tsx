/**
 * GuardPay AI — AmountScreen
 * Numeric amount input with live amount-in-words display and optional note field.
 * On "Confirm", navigates to RiskEvalScreen.
 */

import React, { useState } from 'react';
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
import { amountInWords, formatINRCompact } from '../services/format';
import { useScaledFont } from '../context/SeniorModeContext';
import {
  NAVY,
  NAVY_LIGHT,
  NEUTRAL_GRAY,
  NEUTRAL_LIGHT,
  WHITE,
  ALLOWED_GREEN,
  WARNING_AMBER,
} from '../theme/colors';

type Props = NativeStackScreenProps<RootStackParamList, 'Amount'>;

export function AmountScreen({ route, navigation }: Props) {
  const { beneficiary } = route.params;
  const { t } = useTranslation();
  const sf = useScaledFont();
  const [rawAmount, setRawAmount] = useState('');
  const [note, setNote] = useState('');

  const amount = parseFloat(rawAmount) || 0;
  const wordsLine = amount > 0 ? amountInWords(amount) : '';

  const handleConfirm = () => {
    if (amount <= 0) return;
    // Legacy route: RiskEval now mints its own session id via createSession().
    navigation.navigate('RiskEval', { sessionId: '', beneficiary, amount, note: note || undefined });
  };

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={NAVY} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* Beneficiary summary */}
          <View
            style={styles.payeeTag}
            accessible={true}
            accessibilityRole="summary"
            accessibilityLabel={
              `Paying to ${beneficiary.name}, ${beneficiary.upiId}.` +
              (beneficiary.isNewBeneficiary ? ` ${t('beneficiary.newPayee')}` : '')
            }
          >
            <Text style={[styles.payeeLabel, { fontSize: sf(11) }]}>Paying to</Text>
            <Text style={[styles.payeeName, { fontSize: sf(17) }]}>{beneficiary.name}</Text>
            <Text style={[styles.payeeUpi, { fontSize: sf(12) }]}>{beneficiary.upiId}</Text>
            {beneficiary.isNewBeneficiary && (
              <View style={styles.newBadge}>
                <Text style={[styles.newBadgeText, { fontSize: sf(10) }]}>
                  {t('badge.new')}
                </Text>
              </View>
            )}
          </View>

          <Text
            style={[styles.heading, { fontSize: sf(22) }]}
            accessibilityRole="header"
          >
            {t('amount.placeholder')}
          </Text>

          {/* Amount Input */}
          <View style={styles.amountRow}>
            <Text style={[styles.currencySymbol, { fontSize: sf(32) }]}>₹</Text>
            <TextInput
              testID="amount-input"
              style={[styles.amountInput, { fontSize: sf(40) }]}
              placeholder="0"
              placeholderTextColor={NEUTRAL_GRAY}
              value={rawAmount}
              onChangeText={setRawAmount}
              keyboardType="numeric"
              autoFocus
              maxLength={10}
              accessible={true}
              accessibilityLabel={t('amount.placeholder')}
              accessibilityHint="Enter the rupee amount you want to send"
            />
          </View>

          {/* Amount in Words */}
          {wordsLine ? (
            <Text
              testID="amount-in-words"
              style={[styles.amountWords, { fontSize: sf(13) }]}
              accessibilityLiveRegion="polite"
              accessibilityLabel={wordsLine}
            >
              {wordsLine}
            </Text>
          ) : null}

          {/* Note Field */}
          <TextInput
            testID="note-input"
            style={[styles.noteInput, { fontSize: sf(14) }]}
            placeholder={t('amount.notePlaceholder')}
            placeholderTextColor={NEUTRAL_GRAY}
            value={note}
            onChangeText={setNote}
            maxLength={100}
            accessible={true}
            accessibilityLabel={t('amount.notePlaceholder')}
            accessibilityHint="Optional message shown with this payment"
          />

          {/* Confirm Button */}
          <TouchableOpacity
            testID="confirm-btn"
            style={[styles.confirmBtn, amount <= 0 && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={amount <= 0}
            activeOpacity={0.85}
            accessible={true}
            accessibilityRole="button"
            accessibilityState={{ disabled: amount <= 0 }}
            accessibilityLabel={
              amount > 0
                ? `${t('amount.confirm')} — ${formatINRCompact(amount)} to ${beneficiary.name}`
                : t('amount.placeholder')
            }
            accessibilityHint="Runs the GuardPay fraud check before the payment is made"
          >
            <Text style={[styles.confirmBtnText, { fontSize: sf(17) }]}>
              {amount > 0 ? `${t('amount.confirm')} · ${formatINRCompact(amount)}` : t('amount.placeholder')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: NAVY },
  content: { padding: 24, flexGrow: 1 },
  payeeTag: {
    backgroundColor: NAVY_LIGHT,
    borderRadius: 14,
    padding: 16,
    marginBottom: 28,
  },
  payeeLabel: { color: NEUTRAL_GRAY, fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 },
  payeeName: { color: WHITE, fontSize: 17, fontWeight: '700', marginTop: 4 },
  payeeUpi: { color: NEUTRAL_GRAY, fontSize: 12, marginTop: 2 },
  newBadge: {
    marginTop: 8,
    backgroundColor: WARNING_AMBER,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  newBadgeText: { color: NAVY, fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  heading: { color: WHITE, fontSize: 22, fontWeight: '800', marginBottom: 20 },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: NAVY_LIGHT,
    borderRadius: 16,
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#2A3F55',
  },
  currencySymbol: { color: ALLOWED_GREEN, fontSize: 32, fontWeight: '800', marginRight: 8 },
  amountInput: {
    flex: 1,
    color: WHITE,
    fontSize: 40,
    fontWeight: '800',
    letterSpacing: -1,
  },
  amountWords: {
    color: NEUTRAL_GRAY,
    fontSize: 13,
    marginBottom: 20,
    lineHeight: 20,
    fontStyle: 'italic',
  },
  noteInput: {
    backgroundColor: NAVY_LIGHT,
    color: WHITE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    fontSize: 14,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: '#2A3F55',
  },
  confirmBtn: {
    backgroundColor: ALLOWED_GREEN,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.4 },
  confirmBtnText: { color: NAVY, fontSize: 17, fontWeight: '700' },
});
