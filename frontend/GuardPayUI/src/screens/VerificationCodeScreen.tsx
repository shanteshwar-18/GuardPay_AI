/**
 * GuardPay AI — VerificationCodeScreen (§20)
 *
 * The 4-digit code step. The code is issued out-of-band (to the trusted contact
 * or the registered channel) — it is never shown here, and there is no "skip".
 *
 * Gate behaviour:
 *   • A verified code only unlocks the PIN pad when isPinReachable(tier, true)
 *     says so. For INTERCEPT that is false even after a correct code, so the
 *     success path returns to the decision screen instead.
 *   • Exhausted attempts / a frozen session end the flow at Home. There is no
 *     bypass, no "continue anyway", and no retry after a freeze.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StackActions } from '@react-navigation/native';
import { useTranslation } from 'react-i18next';

import {
  Card,
  OtpInput,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  SecurityAlert,
  useFontScale,
} from '../components/guardpay';
import { theme } from '../theme';
import { isPinReachable } from '../config/riskTiers';
import { ApiError, requestVerification, verifyCode } from '../services/api';
import { formatINRCompact } from '../services/format';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'VerificationCode'>;

const CODE_LENGTH = 4;
const RESEND_SECONDS = 30;

export function VerificationCodeScreen({ route, navigation }: Props) {
  const { sessionId, transactionId, beneficiary, amount, note, tier, riskScore } = route.params;

  const { t } = useTranslation();
  const tr = useCallback(
    (key: string, opts?: Record<string, unknown>): string => String(t(key, opts ?? {})),
    [t],
  );
  const { sf } = useFontScale();

  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [resending, setResending] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [attemptsLeft, setAttemptsLeft] = useState<number | null>(null);
  const [frozen, setFrozen] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);

  const aliveRef = useRef(true);
  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // ── Resend countdown ───────────────────────────────────────────────────────
  useEffect(() => {
    if (secondsLeft <= 0) return undefined;
    const timer = setTimeout(() => setSecondsLeft(s => Math.max(0, s - 1)), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  // ── Where a successful verification goes ───────────────────────────────────
  /** Pop back to the decision screen if it is still on the stack, else Home. */
  const returnToDecision = useCallback(() => {
    const state = navigation.getState();
    const names = state?.routes?.map(r => r.name) ?? [];
    const index = names.lastIndexOf('RiskDecision');
    if (index >= 0 && typeof state?.index === 'number' && state.index > index) {
      navigation.dispatch(StackActions.pop(state.index - index));
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }, [navigation]);

  const onVerified = useCallback(() => {
    // Central gate. `true` here means "verification passed"; INTERCEPT still
    // refuses, so a blocked payment cannot buy its way to the PIN pad.
    if (isPinReachable(tier, true)) {
      navigation.replace('Pin', {
        sessionId,
        transactionId,
        beneficiary,
        amount,
        note,
        tier,
        riskScore,
        verified: true,
      });
      return;
    }
    returnToDecision();
  }, [
    tier,
    navigation,
    sessionId,
    transactionId,
    beneficiary,
    amount,
    note,
    riskScore,
    returnToDecision,
  ]);

  const freeze = useCallback(() => {
    setFrozen(true);
    setErrorText(tr('verification.frozenBody'));
  }, [tr]);

  const goHome = useCallback(() => {
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }, [navigation]);

  // ── Verify ─────────────────────────────────────────────────────────────────
  const handleVerify = useCallback(
    async (submitted?: string) => {
      const value = (submitted ?? code).replace(/\D/g, '');
      if (frozen || busy || value.length !== CODE_LENGTH) return;

      setBusy(true);
      setErrorText(null);
      try {
        const res = await verifyCode(sessionId, value);
        if (!aliveRef.current) return;

        if (res.verified) {
          onVerified();
          return;
        }

        const remaining =
          typeof res.attempts_remaining === 'number' ? res.attempts_remaining : null;
        setAttemptsLeft(remaining);
        setCode('');

        if (String(res.state ?? '').toUpperCase() === 'FROZEN' || (remaining !== null && remaining <= 0)) {
          freeze();
          return;
        }
        setErrorText(tr('verification.invalid'));
      } catch (err) {
        if (!aliveRef.current) return;
        setCode('');

        if (err instanceof ApiError) {
          const body = (err.body ?? {}) as { attempts_remaining?: number; state?: string };
          const remaining =
            typeof body.attempts_remaining === 'number' ? body.attempts_remaining : null;
          setAttemptsLeft(remaining);

          // 403/423 from the gate, an exhausted counter or an explicit FROZEN
          // state all end the flow — never a retry loop.
          if (
            err.status === 403 ||
            err.status === 423 ||
            String(body.state ?? '').toUpperCase() === 'FROZEN' ||
            (remaining !== null && remaining <= 0)
          ) {
            freeze();
            return;
          }
          if (err.status === 410) {
            setErrorText(tr('verification.expired'));
            return;
          }
          setErrorText(tr('verification.invalid'));
          return;
        }

        console.warn('[VerificationCode] verifyCode failed:', err);
        setErrorText(tr('verification.failed'));
      } finally {
        if (aliveRef.current) setBusy(false);
      }
    },
    [code, frozen, busy, sessionId, onVerified, freeze, tr],
  );

  // ── Resend ─────────────────────────────────────────────────────────────────
  const handleResend = useCallback(async () => {
    if (frozen || resending || secondsLeft > 0) return;
    setResending(true);
    setErrorText(null);
    try {
      const res = await requestVerification(sessionId);
      if (!aliveRef.current) return;
      if (res.sent === false) {
        setErrorText(tr('verification.failed'));
        return;
      }
      setCode('');
      setSecondsLeft(RESEND_SECONDS);
    } catch (err) {
      console.warn('[VerificationCode] requestVerification failed:', err);
      if (aliveRef.current) setErrorText(tr('verification.failed'));
    } finally {
      if (aliveRef.current) setResending(false);
    }
  }, [frozen, resending, secondsLeft, sessionId, tr]);

  const resendLabel = useMemo(
    () =>
      secondsLeft > 0
        ? tr('verification.resendIn', { seconds: secondsLeft })
        : tr('verification.resend'),
    [secondsLeft, tr],
  );

  const attemptsText =
    attemptsLeft !== null && attemptsLeft > 0
      ? tr('verification.attemptsLeft', { count: attemptsLeft })
      : null;

  return (
    <ScreenContainer
      testID="verification-code-screen"
      scroll
      contentStyle={styles.content}
      footer={
        frozen ? (
          <PrimaryButton
            testID="verification-frozen-home"
            label={tr('success.backHome')}
            tone="danger"
            onPress={goHome}
            accessibilityHint={tr('verification.frozenBody')}
          />
        ) : (
          <View>
            <PrimaryButton
              testID="verification-verify"
              label={tr('verification.verify')}
              loading={busy}
              disabled={code.length !== CODE_LENGTH}
              onPress={() => void handleVerify()}
              accessibilityHint={tr('verification.body')}
            />
            <SecondaryButton
              testID="verification-resend"
              label={resendLabel}
              variant="ghost"
              loading={resending}
              disabled={secondsLeft > 0}
              onPress={() => void handleResend()}
              style={styles.footerGap}
            />
          </View>
        )
      }
    >
      <Text
        accessibilityRole="header"
        allowFontScaling={false}
        style={[
          styles.title,
          { fontSize: sf(theme.typography.h1.size), lineHeight: sf(theme.typography.h1.lineHeight) },
        ]}
      >
        {tr('verification.title')}
      </Text>

      <Text
        allowFontScaling={false}
        style={[
          styles.body,
          { fontSize: sf(theme.typography.body.size), lineHeight: sf(theme.typography.body.lineHeight) },
        ]}
      >
        {tr('verification.body')}
      </Text>

      {frozen ? (
        <SecurityAlert
          testID="verification-frozen"
          tone="danger"
          title={tr('verification.failed')}
          message={tr('verification.frozenBody')}
          style={styles.alert}
        />
      ) : (
        <>
          <OtpInput
            testID="verification-otp"
            length={CODE_LENGTH}
            value={code}
            onChange={setCode}
            onComplete={next => void handleVerify(next)}
            error={Boolean(errorText)}
            errorMessage={errorText ?? undefined}
            disabled={busy}
            autoFocus
            accessibilityLabel={tr('verification.title')}
            accessibilityHint={tr('verification.body')}
            style={styles.otp}
          />

          {attemptsText ? (
            <Text
              testID="verification-attempts"
              accessibilityLiveRegion="polite"
              allowFontScaling={false}
              style={[styles.attempts, { fontSize: sf(theme.typography.caption.size) }]}
            >
              {attemptsText}
            </Text>
          ) : null}
        </>
      )}

      <Card testID="verification-payment" style={styles.paymentCard}>
        <Text
          allowFontScaling={false}
          style={[styles.paymentLabel, { fontSize: sf(theme.typography.tiny.size) }]}
        >
          {tr('activity.amount')}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.paymentAmount, { fontSize: sf(theme.typography.h2.size) }]}
        >
          {formatINRCompact(amount)}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.paymentPayee, { fontSize: sf(theme.typography.caption.size) }]}
        >
          {`${tr('success.paidTo')} ${beneficiary.name}`}
        </Text>
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: theme.spacing.xxl,
  },
  title: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  body: {
    color: theme.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xxl,
  },
  otp: {
    marginBottom: theme.spacing.lg,
  },
  attempts: {
    color: theme.risk.warning.dark,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: theme.spacing.lg,
  },
  alert: {
    marginBottom: theme.spacing.xl,
  },
  paymentCard: {
    alignItems: 'center',
    marginTop: theme.spacing.sm,
  },
  paymentLabel: {
    color: theme.neutral.textMuted,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  paymentAmount: {
    color: theme.brand.navy,
    fontWeight: '700',
    marginTop: theme.spacing.xs,
  },
  paymentPayee: {
    color: theme.neutral.textSecondary,
    marginTop: theme.spacing.xs,
  },
  footerGap: {
    marginTop: theme.spacing.md,
  },
});

export default VerificationCodeScreen;
