/**
 * GuardPay AI — TrustedContactScreen (§19)
 *
 * The out-of-band verification step for HOLD and INTERCEPT: GuardPay calls a
 * person the user already trusts and asks them to confirm the payment. The user
 * cannot self-approve here — the only forward move is the code their trusted
 * contact receives, entered on VerificationCodeScreen.
 *
 * Honesty rule: when the backend reports the IVR call as simulated, the screen
 * says so. A demo call is never dressed up as a real one.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  Card,
  PrimaryButton,
  ScreenContainer,
  SecondaryButton,
  SecurityAlert,
  TrustedContactCard,
  useFontScale,
} from '../components/guardpay';
import { theme } from '../theme';
import {
  cancelSession,
  getSessionStatus,
  listTrustedContacts,
  maskPhone,
  requestVerification,
} from '../services/api';
import type { TrustedContact as TrustedContactDto } from '../services/api';
import { formatINRCompact } from '../services/format';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'TrustedContact'>;

type CallState = 'calling' | 'connected' | 'waiting';

const POLL_INTERVAL_MS = 4000;
/** How long the "Calling…" stage shows before it reads as connected. */
const CONNECT_DELAY_MS = 2500;

const CALL_STATE_KEY: Record<CallState, string> = {
  calling: 'trustedContact.calling',
  connected: 'trustedContact.connected',
  waiting: 'trustedContact.waiting',
};

export function TrustedContactScreen({ route, navigation }: Props) {
  const { sessionId, transactionId, beneficiary, amount, note, tier, riskScore } = route.params;

  const { t } = useTranslation();
  const tr = useCallback(
    (key: string, opts?: Record<string, unknown>): string => String(t(key, opts ?? {})),
    [t],
  );
  const { sf } = useFontScale();

  const [contact, setContact] = useState<TrustedContactDto | null>(null);
  const [contactsLoaded, setContactsLoaded] = useState(false);
  const [callState, setCallState] = useState<CallState>('calling');
  const [simulated, setSimulated] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [ending, setEnding] = useState(false);

  const aliveRef = useRef(true);
  const pulse = useRef(new Animated.Value(0)).current;

  // ── Who are we calling? ────────────────────────────────────────────────────
  useEffect(() => {
    aliveRef.current = true;
    (async () => {
      try {
        const contacts = await listTrustedContacts();
        if (!aliveRef.current) return;
        const list = Array.isArray(contacts) ? contacts : [];
        // GuardPay calls the primary contact first, falling back to the first entry.
        setContact(list.find(c => c.is_primary) ?? list[0] ?? null);
      } catch (err) {
        console.warn('[TrustedContact] listTrustedContacts failed:', err);
        if (aliveRef.current) setContact(null);
      } finally {
        if (aliveRef.current) setContactsLoaded(true);
      }
    })();
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // ── Trigger the IVR call ───────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await requestVerification(sessionId);
        if (!alive) return;
        setSimulated(Boolean(res.simulated));
        if (res.sent === false) {
          setErrorText(tr('verification.failed'));
        }
      } catch (err) {
        console.warn('[TrustedContact] requestVerification failed:', err);
        if (alive) setErrorText(tr('verification.failed'));
      }
    })();
    return () => {
      alive = false;
    };
  }, [sessionId, tr]);

  // ── Animated call-state progression ────────────────────────────────────────
  useEffect(() => {
    if (callState !== 'calling') return undefined;
    const timer = setTimeout(() => setCallState('connected'), CONNECT_DELAY_MS);
    return () => clearTimeout(timer);
  }, [callState]);

  // ── Poll the session so the state reflects the backend, not a local timer ──
  useEffect(() => {
    const pollId = transactionId ?? sessionId;
    if (!pollId) return undefined;
    let alive = true;

    const poll = async () => {
      try {
        const status = await getSessionStatus(pollId);
        if (!alive) return;
        const outcome = String(status.ivr_outcome ?? status.status ?? '').toUpperCase();
        if (outcome.includes('FROZEN') || outcome.includes('REJECT') || outcome.includes('DENIED')) {
          setErrorText(tr('verification.frozenBody'));
          return;
        }
        // Any answered/settled signal means the contact is on the line and the
        // code is now in their hands.
        if (outcome) setCallState('waiting');
      } catch (err) {
        // Polling is progressive enhancement — a failure must not break the flow.
        console.warn('[TrustedContact] getSessionStatus failed:', err);
      }
    };

    void poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      alive = false;
      clearInterval(interval);
    };
  }, [transactionId, sessionId, tr]);

  // ── Subtle breathing dot while the call is live (cleaned up on unmount) ────
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 800,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
      pulse.setValue(0);
    };
  }, [pulse]);

  const dotOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 1] });

  // ── Actions ────────────────────────────────────────────────────────────────
  const handleEndCall = useCallback(async () => {
    if (ending) return;
    setEnding(true);
    try {
      await cancelSession(sessionId);
    } catch (err) {
      console.warn('[TrustedContact] cancelSession failed:', err);
    } finally {
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  }, [ending, sessionId, navigation]);

  const handleEnterCode = useCallback(() => {
    navigation.navigate('VerificationCode', {
      sessionId,
      transactionId,
      beneficiary,
      amount,
      note,
      tier,
      riskScore,
      origin: 'trustedContact',
    });
  }, [navigation, sessionId, transactionId, beneficiary, amount, note, tier, riskScore]);

  const stateLabel = tr(CALL_STATE_KEY[callState]);

  const hasContact = contact != null;
  const maskedPhone = useMemo(
    () => (contact?.phone_number ? maskPhone(contact.phone_number) : ''),
    [contact],
  );

  return (
    <ScreenContainer
      testID="trusted-contact-screen"
      scroll
      contentStyle={styles.content}
      footer={
        <View>
          <PrimaryButton
            testID="trusted-contact-enter-code"
            label={tr('trustedContact.enterCode')}
            onPress={handleEnterCode}
            accessibilityHint={tr('verification.body')}
          />
          <SecondaryButton
            testID="trusted-contact-end-call"
            label={tr('trustedContact.endCall')}
            tone="danger"
            loading={ending}
            onPress={handleEndCall}
            accessibilityHint={tr('risk.common.cancel')}
            style={styles.footerGap}
          />
        </View>
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
        {tr('trustedContact.title')}
      </Text>

      <Text
        allowFontScaling={false}
        style={[
          styles.body,
          { fontSize: sf(theme.typography.body.size), lineHeight: sf(theme.typography.body.lineHeight) },
        ]}
      >
        {tr('trustedContact.body')}
      </Text>

      {/* Call state is a word plus a glyph, never colour alone (§48). */}
      <View
        testID="trusted-contact-state"
        accessible
        accessibilityRole="text"
        accessibilityLiveRegion="polite"
        accessibilityLabel={stateLabel}
        style={styles.stateRow}
      >
        <Animated.View style={[styles.stateDot, { opacity: dotOpacity }]} />
        <Text
          allowFontScaling={false}
          style={[styles.stateText, { fontSize: sf(theme.typography.bodyBold.size) }]}
        >
          {stateLabel}
        </Text>
      </View>

      {!contactsLoaded ? (
        <View style={styles.loading} accessibilityLabel={tr('common.loading')} accessible>
          <ActivityIndicator color={theme.brand.blue} />
        </View>
      ) : hasContact ? (
        <Card testID="trusted-contact-card" padded={false} style={styles.contactCard}>
          <TrustedContactCard
            name={contact!.name}
            relationship={contact!.relationship}
            phoneMasked={maskedPhone}
            isPrimary={contact!.is_primary ?? true}
            primaryLabel={tr('settings.trustedContacts')}
          />
        </Card>
      ) : (
        <SecurityAlert
          testID="trusted-contact-none"
          tone="warning"
          title={tr('trustedContact.noContact')}
          message={tr('trustedContact.noContactBody')}
          style={styles.alert}
        />
      )}

      {simulated ? (
        <SecurityAlert
          testID="trusted-contact-simulated"
          tone="info"
          title={tr('trustedContact.simulatedNote')}
          compact
          style={styles.alert}
        />
      ) : null}

      {errorText ? (
        <SecurityAlert
          testID="trusted-contact-error"
          tone="danger"
          title={errorText}
          style={styles.alert}
        />
      ) : null}

      <Card testID="trusted-contact-payment" style={styles.paymentCard}>
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
    marginBottom: theme.spacing.xl,
  },
  stateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    minHeight: theme.control.minTouch,
    paddingHorizontal: theme.spacing.lg,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.risk.safe.soft,
    borderWidth: 1,
    borderColor: theme.risk.safe.border,
    marginBottom: theme.spacing.xl,
  },
  stateDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: theme.status.liveCall,
    marginRight: theme.spacing.sm,
  },
  stateText: {
    color: theme.risk.safe.dark,
    fontWeight: '700',
  },
  loading: {
    paddingVertical: theme.spacing.xxl,
    alignItems: 'center',
  },
  contactCard: {
    marginBottom: theme.spacing.lg,
    overflow: 'hidden',
  },
  alert: {
    marginBottom: theme.spacing.lg,
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

export default TrustedContactScreen;
