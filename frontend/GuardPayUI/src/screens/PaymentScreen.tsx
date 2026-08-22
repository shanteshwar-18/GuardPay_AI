/**
 * GuardPay AI — PaymentScreen  ·  product spec §10
 *
 * Payment entry: who is being paid, how much, and an optional note. Nothing
 * here authorizes anything — the protected session and the risk evaluation are
 * created by RiskEvalScreen, so this screen deliberately:
 *   • never shows a PIN pad (§21, §37),
 *   • passes `sessionId: ''` — RiskEval mints the real one,
 *   • treats the "new beneficiary" flag as display data only; the backend
 *     remains the authority on beneficiary risk (§42).
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
  Keyboard,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  AppHeader,
  BeneficiaryCard,
  Card,
  PrimaryButton,
  ScreenContainer,
} from '../components/guardpay';
import { useScaledFont, useSeniorMode } from '../context/SeniorModeContext';
import {
  MOCK_KNOWN_BENEFICIARIES,
  MOCK_PAYEE_NAMES,
  MOCK_RECENT_TRANSACTIONS,
} from '../mock/mockData';
import { amountInWords, normaliseUpiId } from '../services/format';
import theme from '../theme';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Payment'>;

/** handle@psp — deliberately permissive; the backend re-validates. */
const UPI_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9.\-_]{1,255})@[a-zA-Z][a-zA-Z0-9]{1,63}$/;

const MAX_NOTE_LENGTH = 80;

/** Recent payees, de-duplicated by UPI id. Display data only. */
const RECENT_BENEFICIARIES = MOCK_RECENT_TRANSACTIONS.filter(
  (txn, index, all) => all.findIndex(other => other.upiId === txn.upiId) === index,
);

function isKnownBeneficiary(upiId: string): boolean {
  return MOCK_KNOWN_BENEFICIARIES.indexOf(normaliseUpiId(upiId)) !== -1;
}

function resolvePayeeName(upiId: string): string {
  const normalised = normaliseUpiId(upiId);
  const known = MOCK_PAYEE_NAMES[normalised];
  if (known) return known;
  const handle = normalised.split('@')[0] || normalised;
  return handle.charAt(0).toUpperCase() + handle.slice(1);
}

/** Strip everything that is not a digit or a single decimal point. */
function sanitiseAmount(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '');
  const firstDot = cleaned.indexOf('.');
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) + cleaned.slice(firstDot + 1).replace(/\./g, '')
  );
}

export function PaymentScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const sf = useScaledFont();
  const { fontScale } = useSeniorMode();

  const [upiId, setUpiId] = useState(route.params?.prefillUpiId ?? '');
  const [amountText, setAmountText] = useState('');
  const [note, setNote] = useState('');
  const [upiError, setUpiError] = useState<string | null>(null);
  const [amountError, setAmountError] = useState<string | null>(null);

  const amountValue = useMemo(() => {
    const parsed = Number.parseFloat(amountText);
    return Number.isFinite(parsed) ? parsed : 0;
  }, [amountText]);

  const words = useMemo(() => amountInWords(amountValue), [amountValue]);

  const isNewBeneficiary = useMemo(
    () => (upiId.trim() ? !isKnownBeneficiary(upiId) : false),
    [upiId],
  );

  const onSelectBeneficiary = useCallback((selectedUpi: string) => {
    setUpiId(selectedUpi);
    setUpiError(null);
  }, []);

  const validate = useCallback((): boolean => {
    let ok = true;

    if (!UPI_PATTERN.test(upiId.trim())) {
      setUpiError(t('payment.invalidUpi'));
      ok = false;
    } else {
      setUpiError(null);
    }

    if (!(amountValue > 0)) {
      setAmountError(t('payment.invalidAmount'));
      ok = false;
    } else {
      setAmountError(null);
    }

    return ok;
  }, [amountValue, t, upiId]);

  const onProceed = useCallback(() => {
    Keyboard.dismiss();
    if (!validate()) return;

    const cleanUpi = normaliseUpiId(upiId);
    navigation.navigate('RiskEval', {
      // RiskEval creates the protected session — never fabricate an id here.
      sessionId: '',
      beneficiary: {
        upiId: cleanUpi,
        name: resolvePayeeName(cleanUpi),
        isNewBeneficiary: !isKnownBeneficiary(cleanUpi),
      },
      amount: amountValue,
      note: note.trim() ? note.trim() : undefined,
    });
  }, [amountValue, navigation, note, upiId, validate]);

  const canProceed = upiId.trim().length > 0 && amountValue > 0;

  const renderFieldLabel = (label: string) => (
    <Text
      allowFontScaling={false}
      style={[styles.label, { fontSize: sf(theme.typography.caption.size) }]}
    >
      {label}
    </Text>
  );

  const renderError = (message: string | null, testID: string) =>
    message ? (
      <Text
        testID={testID}
        allowFontScaling={false}
        accessibilityLiveRegion="polite"
        accessibilityRole="alert"
        style={[styles.error, { fontSize: sf(theme.typography.caption.size) }]}
      >
        ⚠ {message}
      </Text>
    ) : null;

  return (
    <ScreenContainer
      testID="payment-screen"
      scroll
      padded={false}
      contentStyle={styles.content}
      footer={
        <PrimaryButton
          testID="payment-proceed"
          label={t('payment.proceed')}
          onPress={onProceed}
          disabled={!canProceed}
          accessibilityHint={t('session.checking')}
          fontScale={fontScale}
        />
      }
    >
      <AppHeader
        testID="payment-header"
        title={t('payment.title')}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t('risk.common.back')}
        backAccessibilityHint={t('nav.home')}
        fontScale={fontScale}
        style={styles.header}
      />

      <View style={styles.gutter}>
        {/* ── Payee ────────────────────────────────────────────────────── */}
        <Card testID="payment-payee" style={styles.block}>
          {renderFieldLabel(t('payment.upiLabel'))}
          <TextInput
            testID="payment-upi-input"
            value={upiId}
            onChangeText={value => {
              setUpiId(value);
              if (upiError) setUpiError(null);
            }}
            placeholder={t('payment.upiPlaceholder')}
            placeholderTextColor={theme.neutral.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            allowFontScaling={false}
            accessibilityLabel={t('payment.upiLabel')}
            accessibilityHint={t('payment.upiPlaceholder')}
            style={[
              styles.input,
              upiError ? styles.inputError : null,
              { fontSize: sf(theme.typography.body.size), minHeight: sf(theme.control.inputHeight) },
            ]}
          />
          {renderError(upiError, 'payment-upi-error')}

          {upiId.trim().length > 0 && !upiError ? (
            <Text
              allowFontScaling={false}
              style={[styles.resolved, { fontSize: sf(theme.typography.caption.size) }]}
            >
              {resolvePayeeName(upiId)}
              {isNewBeneficiary ? ` · ${t('payment.newPayee')}` : ` · ${t('payment.trusted')}`}
            </Text>
          ) : null}
        </Card>

        {/* ── Amount ───────────────────────────────────────────────────── */}
        <Card testID="payment-amount" style={styles.block}>
          {renderFieldLabel(t('payment.amountLabel'))}
          <View style={styles.amountRow}>
            <Text
              allowFontScaling={false}
              style={[styles.currency, { fontSize: sf(theme.typography.h2.size) }]}
            >
              ₹
            </Text>
            <TextInput
              testID="payment-amount-input"
              value={amountText}
              onChangeText={value => {
                setAmountText(sanitiseAmount(value));
                if (amountError) setAmountError(null);
              }}
              placeholder="0"
              placeholderTextColor={theme.neutral.textMuted}
              keyboardType="numeric"
              inputMode="decimal"
              allowFontScaling={false}
              accessibilityLabel={t('payment.amountLabel')}
              style={[
                styles.amountInput,
                amountError ? styles.inputError : null,
                {
                  fontSize: sf(theme.typography.amount.size),
                  minHeight: sf(theme.control.inputHeight),
                },
              ]}
            />
          </View>
          {renderError(amountError, 'payment-amount-error')}
          {words ? (
            <Text
              testID="payment-amount-words"
              allowFontScaling={false}
              accessibilityRole="text"
              accessibilityLabel={words}
              style={[styles.words, { fontSize: sf(theme.typography.caption.size) }]}
            >
              {words}
            </Text>
          ) : null}
        </Card>

        {/* ── Note ─────────────────────────────────────────────────────── */}
        <Card testID="payment-note" style={styles.block}>
          {renderFieldLabel(t('payment.noteLabel'))}
          <TextInput
            testID="payment-note-input"
            value={note}
            onChangeText={setNote}
            placeholder={t('payment.notePlaceholder')}
            placeholderTextColor={theme.neutral.textMuted}
            maxLength={MAX_NOTE_LENGTH}
            allowFontScaling={false}
            accessibilityLabel={t('payment.noteLabel')}
            accessibilityHint={t('payment.notePlaceholder')}
            style={[
              styles.input,
              { fontSize: sf(theme.typography.body.size), minHeight: sf(theme.control.inputHeight) },
            ]}
          />
        </Card>

        {/* ── Recent beneficiaries ─────────────────────────────────────── */}
        <Text
          allowFontScaling={false}
          accessibilityRole="header"
          style={[styles.sectionTitle, { fontSize: sf(theme.typography.h3.size) }]}
        >
          {t('payment.recentBeneficiaries')}
        </Text>

        {RECENT_BENEFICIARIES.map(item => {
          const known = isKnownBeneficiary(item.upiId);
          return (
            <BeneficiaryCard
              key={item.id}
              testID={`payment-beneficiary-${item.id}`}
              name={item.name}
              upiId={item.upiId}
              isNew={!known}
              isTrusted={known}
              newLabel={t('payment.newPayee')}
              trustedLabel={t('payment.trusted')}
              selected={normaliseUpiId(upiId) === normaliseUpiId(item.upiId)}
              onPress={() => onSelectBeneficiary(item.upiId)}
              accessibilityHint={t('payment.upiLabel')}
              fontScale={fontScale}
              style={styles.rowGap}
            />
          );
        })}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing.xxl },
  header: { paddingHorizontal: theme.spacing.xl },
  gutter: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.lg },
  block: { marginBottom: theme.spacing.lg },
  rowGap: { marginBottom: theme.spacing.md },
  label: {
    color: theme.neutral.textSecondary,
    fontWeight: '600',
    marginBottom: theme.spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.neutral.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.neutral.surfaceAlt,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.md,
    color: theme.neutral.textPrimary,
  },
  inputError: { borderColor: theme.risk.intercept.main, borderWidth: 2 },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  currency: {
    color: theme.neutral.textSecondary,
    fontWeight: theme.typography.h2.weight,
    marginRight: theme.spacing.sm,
  },
  amountInput: {
    flex: 1,
    color: theme.neutral.textPrimary,
    fontWeight: theme.typography.amount.weight,
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: theme.neutral.border,
  },
  words: { color: theme.neutral.textSecondary, marginTop: theme.spacing.md },
  resolved: { color: theme.brand.blueDark, marginTop: theme.spacing.sm, fontWeight: '600' },
  error: { color: theme.risk.intercept.dark, marginTop: theme.spacing.sm, fontWeight: '600' },
  sectionTitle: {
    color: theme.neutral.textPrimary,
    fontWeight: theme.typography.h3.weight,
    marginBottom: theme.spacing.md,
  },
});

export default PaymentScreen;
