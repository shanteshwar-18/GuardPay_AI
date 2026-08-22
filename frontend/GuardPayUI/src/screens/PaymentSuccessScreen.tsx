/**
 * GuardPay AI — PaymentSuccessScreen (§22)
 *
 * The end of a protected payment. The transaction is simulated, so the receipt
 * carries a simulated UPI reference rather than anything that could be mistaken
 * for a bank record.
 *
 * Hardware back is intercepted and routed Home — the payment is done, so walking
 * backwards into the PIN pad or the decision screen must not be possible.
 */

import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Animated, BackHandler, Easing, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  Card,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  useFontScale,
} from '../components/guardpay';
import { theme } from '../theme';
import { formatINRCompact } from '../services/format';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'PaymentSuccess'>;

const PAD = (n: number) => String(n).padStart(2, '0');

/**
 * Locale-independent receipt timestamp. Intl date formatting is not guaranteed
 * on every Android/Hermes build, so this is assembled from Date parts.
 */
function formatTimestamp(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const date = Number.isNaN(d.getTime()) ? new Date() : d;
  const hours24 = date.getHours();
  const suffix = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  return (
    `${PAD(date.getDate())}/${PAD(date.getMonth() + 1)}/${date.getFullYear()} ` +
    `${PAD(hours12)}:${PAD(date.getMinutes())} ${suffix}`
  );
}

/** Simulated UPI reference derived from the backend transaction id. */
function simulatedUpiRef(transactionId: string): string {
  const digits = String(transactionId).replace(/\D/g, '');
  const padded = (digits + '000000000000').slice(0, 12);
  return `SIM${padded}`;
}

export function PaymentSuccessScreen({ route, navigation }: Props) {
  const { transactionId, amount, beneficiary, completedAt } = route.params;

  const { t } = useTranslation();
  const tr = useCallback(
    (key: string, opts?: Record<string, unknown>): string => String(t(key, opts ?? {})),
    [t],
  );
  const { sf } = useFontScale();

  const pop = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  const goHome = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }, [navigation]);

  // Back always means "Home" here — never back into the payment flow.
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: false });
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      goHome();
      return true;
    });
    return () => sub.remove();
  }, [navigation, goHome]);

  // Check mark springs in, body fades up. Both stopped on unmount (§47).
  useEffect(() => {
    const anim = Animated.parallel([
      Animated.spring(pop, {
        toValue: 1,
        friction: 5,
        tension: 90,
        useNativeDriver: true,
      }),
      Animated.timing(fade, {
        toValue: 1,
        duration: 380,
        delay: 120,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [pop, fade]);

  const checkScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] });

  const timestamp = useMemo(() => formatTimestamp(completedAt), [completedAt]);
  const upiRef = useMemo(() => simulatedUpiRef(transactionId), [transactionId]);

  const handleViewDetails = useCallback(() => {
    navigation.navigate('TransactionDetail', { transactionId });
  }, [navigation, transactionId]);

  const rows: Array<{ label: string; value: string; testID: string }> = [
    { label: tr('success.paidTo'), value: beneficiary.name, testID: 'success-paid-to' },
    { label: tr('payment.upiLabel'), value: beneficiary.upiId, testID: 'success-upi' },
    { label: tr('activity.time'), value: timestamp, testID: 'success-time' },
    { label: tr('success.txnId'), value: upiRef, testID: 'success-txn' },
  ];

  return (
    <ScreenContainer
      testID="payment-success-screen"
      scroll
      contentStyle={styles.content}
      footer={
        <View>
          <PrimaryButton
            testID="success-view-details"
            label={tr('success.viewDetails')}
            tone="success"
            onPress={handleViewDetails}
            accessibilityHint={tr('activity.detailTitle')}
          />
          <SecondaryButton
            testID="success-back-home"
            label={tr('success.backHome')}
            variant="outlined"
            onPress={goHome}
            style={styles.footerGap}
          />
        </View>
      }
    >
      <Animated.View style={[styles.checkWrap, { transform: [{ scale: checkScale }] }]}>
        <View
          style={styles.checkHalo}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          <View style={styles.checkCircle}>
            <Text allowFontScaling={false} style={[styles.checkGlyph, { fontSize: sf(40) }]}>
              ✓
            </Text>
          </View>
        </View>
      </Animated.View>

      <Animated.View style={{ opacity: fade }}>
        <Text
          testID="success-title"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          allowFontScaling={false}
          style={[
            styles.title,
            { fontSize: sf(theme.typography.h1.size), lineHeight: sf(theme.typography.h1.lineHeight) },
          ]}
        >
          {tr('success.title')}
        </Text>

        <Text
          testID="success-amount"
          accessible
          accessibilityRole="text"
          accessibilityLabel={`${formatINRCompact(amount)}. ${tr('success.paidTo')} ${beneficiary.name}`}
          allowFontScaling={false}
          style={[
            styles.amount,
            { fontSize: sf(theme.typography.amount.size), lineHeight: sf(theme.typography.amount.lineHeight) },
          ]}
        >
          {formatINRCompact(amount)}
        </Text>

        <Card testID="success-receipt" style={styles.receipt}>
          {rows.map((row, i) => (
            <View
              key={row.testID}
              testID={row.testID}
              accessible
              accessibilityRole="text"
              accessibilityLabel={`${row.label}: ${row.value}`}
              style={[styles.row, i === rows.length - 1 && styles.rowLast]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.rowLabel, { fontSize: sf(theme.typography.caption.size) }]}
              >
                {row.label}
              </Text>
              <Text
                allowFontScaling={false}
                numberOfLines={2}
                style={[styles.rowValue, { fontSize: sf(theme.typography.bodyBold.size) }]}
              >
                {row.value}
              </Text>
            </View>
          ))}
        </Card>

        <Text
          allowFontScaling={false}
          style={[styles.note, { fontSize: sf(theme.typography.caption.size) }]}
        >
          {tr('pin.subtitle')}
        </Text>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: theme.spacing.huge,
  },
  checkWrap: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  checkHalo: {
    width: 116,
    height: 116,
    borderRadius: 58,
    backgroundColor: theme.risk.safe.soft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkCircle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: theme.risk.safe.main,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkGlyph: {
    color: theme.neutral.textInverse,
    fontWeight: '700',
  },
  title: {
    color: theme.risk.safe.dark,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  amount: {
    color: theme.brand.navy,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  receipt: {
    marginBottom: theme.spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.neutral.border,
  },
  rowLast: {
    borderBottomWidth: 0,
  },
  rowLabel: {
    color: theme.neutral.textSecondary,
    flexShrink: 0,
    marginRight: theme.spacing.lg,
  },
  rowValue: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
    flexShrink: 1,
    textAlign: 'right',
  },
  note: {
    color: theme.neutral.textMuted,
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  footerGap: {
    marginTop: theme.spacing.md,
  },
});

export default PaymentSuccessScreen;
