/**
 * GuardPay AI — PinScreen (§21)
 *
 * Simulated UPI PIN authorization. Two properties matter more than anything on
 * this screen:
 *
 *  1. THE GATE. On mount the screen re-asks isPinReachable(tier, verified). If
 *     the answer is no it immediately `replace`s itself with the decision screen
 *     and renders nothing. That makes the PIN pad unreachable for a blocked
 *     payment even via a stale navigation stack, a deep link or a back-gesture
 *     into an older route. INTERCEPT can never satisfy the guard (riskTiers.ts).
 *
 *  2. NO PIN LEAVES THE DEVICE. The component stores only how many digits have
 *     been entered — not the digits themselves — so there is literally no PIN
 *     value in memory to transmit. api.authorizePayment() sends the length and a
 *     `simulated` flag, nothing else.
 *
 * A 403 from the backend gate is the server correctly refusing an unauthorized
 * transition. It is surfaced as a security message and never retried.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  Card,
  ScreenContainer,
  SecondaryButton,
  SecurityAlert,
  ShieldGlyph,
  useFontScale,
} from '../components/guardpay';
import { theme } from '../theme';
import { isPinReachable } from '../config/riskTiers';
import { ApiError, authorizePayment, cancelSession } from '../services/api';
import type { RiskFactorDto } from '../services/api';
import { formatINRCompact } from '../services/format';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Pin'>;

const PIN_LENGTH = 6;
const BACKSPACE = '⌫';
const KEYS: string[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', BACKSPACE];

export function PinScreen({ route, navigation }: Props) {
  const { sessionId, transactionId, beneficiary, amount, note, tier, riskScore } = route.params;
  const verified = route.params.verified ?? false;

  const { t } = useTranslation();
  const tr = useCallback(
    (key: string, opts?: Record<string, unknown>): string => String(t(key, opts ?? {})),
    [t],
  );
  const { sf } = useFontScale();

  /**
   * THE GATE — evaluated on every render, not just once, so no state update can
   * leave a blocked payment sitting on a live PIN pad.
   */
  const allowed = isPinReachable(tier, verified);

  /** Digits entered so far. Deliberately a COUNT, never the PIN value itself. */
  const [entered, setEntered] = useState(0);
  const [busy, setBusy] = useState(false);
  const [blockedMessage, setBlockedMessage] = useState<string | null>(null);
  const [errorText, setErrorText] = useState<string | null>(null);

  const aliveRef = useRef(true);
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // ── Hard guard: bounce straight back to the decision screen ────────────────
  useEffect(() => {
    if (allowed) return;
    console.warn(`[Pin] blocked tier "${tier}" reached the PIN route — replacing with RiskDecision`);
    navigation.replace('RiskDecision', {
      sessionId,
      transactionId,
      beneficiary,
      amount,
      note,
      tier,
      riskScore,
      factors: [] as RiskFactorDto[],
    });
  }, [allowed, navigation, sessionId, transactionId, beneficiary, amount, note, tier, riskScore]);

  // ── Authorization ──────────────────────────────────────────────────────────
  const authorize = useCallback(async () => {
    if (!allowed || busy || blockedMessage) return;
    setBusy(true);
    setErrorText(null);
    try {
      // No PIN value is passed — only its length, plus the simulated flag.
      const res = await authorizePayment(sessionId, PIN_LENGTH);
      if (!aliveRef.current) return;
      navigation.replace('PaymentSuccess', {
        transactionId: res.transaction_id ?? transactionId ?? sessionId,
        amount,
        beneficiary,
        completedAt: res.completed_at,
      });
    } catch (err) {
      if (!aliveRef.current) return;
      setEntered(0);

      if (err instanceof ApiError && (err.status === 403 || err.status === 423)) {
        // The gate refused this transition. This is a security outcome, not a
        // transient failure: no retry is offered and the pad stays disabled.
        setBlockedMessage(tr('risk.intercept.title'));
        return;
      }

      console.warn('[Pin] authorizePayment failed:', err);
      setErrorText(tr('session.unavailable'));
    } finally {
      if (aliveRef.current) setBusy(false);
    }
  }, [
    allowed,
    busy,
    blockedMessage,
    sessionId,
    transactionId,
    amount,
    beneficiary,
    navigation,
    tr,
  ]);

  // ── Keypad ─────────────────────────────────────────────────────────────────
  const handleKey = useCallback(
    (key: string) => {
      if (!allowed || busy || blockedMessage || key === '') return;

      if (key === BACKSPACE) {
        setEntered(n => Math.max(0, n - 1));
        return;
      }
      if (entered >= PIN_LENGTH) return;

      const next = entered + 1;
      Vibration.vibrate(8);
      setEntered(next);
      // The digit itself is discarded here — only the count is kept.
      if (next === PIN_LENGTH) void authorize();
    },
    [allowed, busy, blockedMessage, entered, authorize],
  );

  // Subtle shake whenever an error appears; stopped on unmount (§47).
  useEffect(() => {
    if (!errorText && !blockedMessage) return undefined;
    const anim = Animated.sequence([
      Animated.timing(shake, { toValue: 1, duration: 55, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -1, duration: 55, easing: Easing.linear, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 55, easing: Easing.linear, useNativeDriver: true }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [errorText, blockedMessage, shake]);

  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });

  const handleCancel = useCallback(async () => {
    try {
      await cancelSession(sessionId);
    } catch (err) {
      console.warn('[Pin] cancelSession failed:', err);
    } finally {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  }, [sessionId, navigation]);

  const dots = useMemo(() => Array.from({ length: PIN_LENGTH }, (_, i) => i < entered), [entered]);

  // Blocked: render nothing while the guard's replace() takes effect, so the pad
  // is never painted for a payment that must not be authorized.
  if (!allowed) return null;

  const padDisabled = busy || Boolean(blockedMessage);

  return (
    <ScreenContainer
      testID="pin-screen"
      scroll
      contentStyle={styles.content}
      footer={
        <SecondaryButton
          testID="pin-cancel"
          label={tr('pin.cancel')}
          tone="danger"
          variant="ghost"
          onPress={() => void handleCancel()}
          accessibilityHint={tr('risk.common.cancel')}
        />
      }
    >
      <View style={styles.header}>
        <ShieldGlyph size={sf(40)} glyph="🔒" color={theme.brand.navy} />
        <Text
          accessibilityRole="header"
          allowFontScaling={false}
          style={[
            styles.title,
            { fontSize: sf(theme.typography.h2.size), lineHeight: sf(theme.typography.h2.lineHeight) },
          ]}
        >
          {tr('pin.title')}
        </Text>
      </View>

      {/* Never let a user believe this is their real bank PIN prompt. */}
      <SecurityAlert
        testID="pin-simulated-note"
        tone="info"
        title={tr('pin.subtitle')}
        message={tr('pin.securityNote')}
        style={styles.alert}
      />

      <Card testID="pin-payment" style={styles.paymentCard}>
        <Text
          allowFontScaling={false}
          style={[styles.paymentAmount, { fontSize: sf(theme.typography.amount.size), lineHeight: sf(theme.typography.amount.lineHeight) }]}
        >
          {formatINRCompact(amount)}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.paymentLabel, { fontSize: sf(theme.typography.caption.size) }]}
        >
          {tr('pin.payingTo')}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.paymentPayee, { fontSize: sf(theme.typography.bodyBold.size) }]}
        >
          {beneficiary.name}
        </Text>
        <Text
          allowFontScaling={false}
          numberOfLines={1}
          style={[styles.paymentUpi, { fontSize: sf(theme.typography.caption.size) }]}
        >
          {beneficiary.upiId}
        </Text>
      </Card>

      {blockedMessage ? (
        <SecurityAlert
          testID="pin-blocked"
          tone="danger"
          title={blockedMessage}
          message={tr('risk.intercept.advice')}
          style={styles.alert}
        />
      ) : null}

      {errorText ? (
        <SecurityAlert
          testID="pin-error"
          tone="warning"
          title={errorText}
          message={tr('session.unavailableBody')}
          style={styles.alert}
        />
      ) : null}

      <Animated.View style={{ transform: [{ translateX: shakeX }] }}>
        <View
          testID="pin-dots"
          accessible
          accessibilityRole="text"
          accessibilityLiveRegion="polite"
          accessibilityLabel={`${entered} / ${PIN_LENGTH}`}
          style={styles.dotRow}
        >
          {dots.map((filled, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                { width: sf(16), height: sf(16), borderRadius: sf(8) },
                filled && styles.dotFilled,
              ]}
            />
          ))}
        </View>
      </Animated.View>

      <View style={styles.keypad}>
        {KEYS.map((key, index) => {
          if (key === '') {
            return <View key={`spacer-${index}`} style={styles.key} />;
          }
          const isBackspace = key === BACKSPACE;
          return (
            <Pressable
              key={key}
              testID={`pin-key-${isBackspace ? 'back' : key}`}
              onPress={() => handleKey(key)}
              disabled={padDisabled}
              accessible
              accessibilityRole="button"
              accessibilityLabel={
                isBackspace ? tr('common.backspace', { defaultValue: 'Backspace' }) : key
              }
              accessibilityState={{ disabled: padDisabled }}
              style={({ pressed }) => [
                styles.key,
                styles.keySurface,
                isBackspace && styles.keyBackspace,
                pressed && !padDisabled && styles.keyPressed,
                padDisabled && styles.keyDisabled,
              ]}
            >
              <Text
                allowFontScaling={false}
                style={[
                  styles.keyText,
                  isBackspace && styles.keyTextBackspace,
                  { fontSize: sf(theme.typography.h2.size) },
                ]}
              >
                {key}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </ScreenContainer>
  );
}

const KEY_WIDTH = '30%';

const styles = StyleSheet.create({
  content: {
    paddingTop: theme.spacing.xl,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  title: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: theme.spacing.md,
  },
  alert: {
    marginBottom: theme.spacing.lg,
  },
  paymentCard: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  paymentAmount: {
    color: theme.brand.navy,
    fontWeight: '700',
  },
  paymentLabel: {
    color: theme.neutral.textMuted,
    marginTop: theme.spacing.sm,
  },
  paymentPayee: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
    marginTop: 2,
  },
  paymentUpi: {
    color: theme.neutral.textSecondary,
    marginTop: 2,
  },
  dotRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: theme.control.minTouch,
    marginBottom: theme.spacing.xl,
  },
  dot: {
    borderWidth: 2,
    borderColor: theme.neutral.borderStrong,
    backgroundColor: 'transparent',
    marginHorizontal: theme.spacing.sm,
  },
  dotFilled: {
    backgroundColor: theme.brand.blue,
    borderColor: theme.brand.blue,
  },
  keypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  key: {
    width: KEY_WIDTH,
    minHeight: theme.control.minTouch + 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
    borderRadius: theme.radius.lg,
  },
  keySurface: {
    backgroundColor: theme.neutral.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.neutral.border,
    ...theme.elevation.sm,
  },
  keyBackspace: {
    backgroundColor: theme.neutral.surfaceAlt,
  },
  keyPressed: {
    backgroundColor: theme.brand.blueSoft,
    borderColor: theme.brand.blueMid,
  },
  keyDisabled: {
    opacity: 0.45,
  },
  keyText: {
    color: theme.neutral.textPrimary,
    fontWeight: '600',
  },
  keyTextBackspace: {
    color: theme.neutral.textSecondary,
  },
});

export default PinScreen;
