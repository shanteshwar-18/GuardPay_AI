/**
 * GuardPay AI — RiskEvalScreen (§11 protected security session)
 *
 * The single entry point into a protected payment. On mount it:
 *   1. creates the backend session               (api.createSession)
 *   2. opens the audio stream, best-effort       (audioStream.startAudioStream)
 *   3. runs the risk evaluation                  (api.evaluateSession)
 *   4. stops the stream and REPLACES itself with the data-driven decision screen
 *
 * FAIL CLOSED (§41): if the evaluation errors, aborts or times out we must never
 * fall through to the PIN pad. The only forward route from the failure state is
 * RiskDecision at WARNING tier, which itself requires a verification step before
 * PIN becomes reachable (config/riskTiers.ts). There is deliberately no code path
 * from this screen to 'Pin'.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  Card,
  PrimaryButton,
  ProtectionSessionIndicator,
  ScreenContainer,
  SecondaryButton,
  SecurityAlert,
  ShieldGlyph,
  useFontScale,
} from '../components/guardpay';
import { theme } from '../theme';
import { RISK_THRESHOLDS, resolveTier } from '../config/riskTiers';
import type { RiskTierId } from '../config/riskTiers';
import { cancelSession, createSession, evaluateSession } from '../services/api';
import type { RiskFactorDto } from '../services/api';
import { startAudioStream, stopAudioStream } from '../services/audioStream';
import { formatINRCompact } from '../services/format';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'RiskEval'>;

/** How long the failure notice stays on screen before the forced WARNING route. */
const FAIL_CLOSED_HOLD_MS = 3500;

/** Progress bar fill duration — cosmetic; the screen unmounts when the tier lands. */
const PROGRESS_MS = 18000;

type Phase = 'evaluating' | 'failed';

export function RiskEvalScreen({ route, navigation }: Props) {
  const { beneficiary, amount, note, transactionId, demoScenario } = route.params;
  const { t } = useTranslation();
  const tr = useCallback((key: string, opts?: Record<string, unknown>): string =>
    String(t(key, opts ?? {})), [t]);
  const { sf } = useFontScale();

  const [phase, setPhase] = useState<Phase>('evaluating');
  const [attempt, setAttempt] = useState(0);

  /** Session id from the backend; kept in a ref so cleanup can cancel it. */
  const sessionIdRef = useRef<string>(route.params.sessionId ?? '');
  const aliveRef = useRef(true);
  const failTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const progress = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  // ── Fail-closed routing ────────────────────────────────────────────────────
  /**
   * The ONLY forward transition available when risk could not be computed.
   * WARNING carries requiresVerification=true and pinAllowed=false, so the user
   * still has to clear a verification step — the payment is never silently let
   * through.
   */
  const goToDecisionUnavailable = useCallback(() => {
    if (!aliveRef.current) return;
    navigation.replace('RiskDecision', {
      sessionId: sessionIdRef.current,
      transactionId,
      beneficiary,
      amount,
      note,
      tier: 'WARNING' as RiskTierId,
      riskScore: RISK_THRESHOLDS.warning,
      factors: [] as RiskFactorDto[],
      requiredAction: 'VERIFY_CODE',
      evidenceBundleId: null,
    });
  }, [navigation, transactionId, beneficiary, amount, note]);

  // ── Entrance + progress animations (stopped on unmount, §47) ───────────────
  useEffect(() => {
    const entrance = Animated.timing(fade, {
      toValue: 1,
      duration: 350,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    });
    entrance.start();
    return () => entrance.stop();
  }, [fade]);

  useEffect(() => {
    if (phase !== 'evaluating') return undefined;
    progress.setValue(0);
    // Width is a layout property — the native driver cannot animate it.
    const fill = Animated.timing(progress, {
      toValue: 0.92,
      duration: PROGRESS_MS,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    });
    fill.start();
    return () => fill.stop();
  }, [phase, progress, attempt]);

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  // ── The security session itself ────────────────────────────────────────────
  useEffect(() => {
    aliveRef.current = true;
    let audioStarted = false;

    const run = async () => {
      // 1. Create the protected session.
      let sessionId = '';
      try {
        const session = await createSession({
          receiver_upi_id: beneficiary.upiId,
          amount,
          note,
        });
        sessionId = session.session_id;
        sessionIdRef.current = sessionId;
      } catch (err) {
        console.warn('[RiskEval] createSession failed — failing closed:', err);
        if (aliveRef.current) setPhase('failed');
        return;
      }

      if (!aliveRef.current) return;

      // 2. Audio streaming is a best-effort signal. It must never block, delay or
      //    fail the security check, so it is fired without awaiting the result.
      try {
        audioStarted = true;
        void startAudioStream(sessionId).catch(e =>
          console.warn('[RiskEval] audio stream unavailable (non-fatal):', e),
        );
      } catch (e) {
        audioStarted = false;
        console.warn('[RiskEval] audio stream failed to start (non-fatal):', e);
      }

      // 3. Evaluate. api.ts owns the timeout and aborts rather than hanging.
      try {
        const evaluation = await evaluateSession(sessionId, demoScenario);

        try {
          stopAudioStream();
        } catch {
          /* stopping a stream that never started is a no-op */
        }
        audioStarted = false;

        if (!aliveRef.current) return;

        const score =
          typeof evaluation.riskScore === 'number' && Number.isFinite(evaluation.riskScore)
            ? Math.round(evaluation.riskScore)
            : RISK_THRESHOLDS.warning;

        // The backend decides; resolveTier only maps its vocabulary onto ours and
        // escalates (never de-escalates) an unrecognised value.
        const tier = resolveTier(evaluation.riskTier, score);

        navigation.replace('RiskDecision', {
          sessionId,
          transactionId: evaluation.transactionId ?? transactionId,
          beneficiary,
          amount,
          note,
          tier,
          riskScore: score,
          factors: Array.isArray(evaluation.factors) ? evaluation.factors : [],
          requiredAction: evaluation.requiredAction,
          evidenceBundleId: evaluation.evidenceBundleId ?? null,
          mode: evaluation.mode,
        });
      } catch (err) {
        try {
          stopAudioStream();
        } catch {
          /* ignore */
        }
        audioStarted = false;
        console.warn('[RiskEval] evaluation failed — failing closed to WARNING:', err);
        if (aliveRef.current) setPhase('failed');
      }
    };

    void run();

    return () => {
      aliveRef.current = false;
      if (audioStarted) {
        try {
          stopAudioStream();
        } catch {
          /* ignore */
        }
      }
    };
  }, [beneficiary, amount, note, demoScenario, transactionId, navigation, attempt]);

  // ── Fail-closed: show the notice, then force the WARNING decision ──────────
  useEffect(() => {
    if (phase !== 'failed') return undefined;
    failTimerRef.current = setTimeout(goToDecisionUnavailable, FAIL_CLOSED_HOLD_MS);
    return () => {
      if (failTimerRef.current) {
        clearTimeout(failTimerRef.current);
        failTimerRef.current = null;
      }
    };
  }, [phase, goToDecisionUnavailable]);

  const handleRetry = useCallback(() => {
    if (failTimerRef.current) {
      clearTimeout(failTimerRef.current);
      failTimerRef.current = null;
    }
    setPhase('evaluating');
    setAttempt(n => n + 1);
  }, []);

  const handleCancel = useCallback(() => {
    if (failTimerRef.current) {
      clearTimeout(failTimerRef.current);
      failTimerRef.current = null;
    }
    const id = sessionIdRef.current;
    if (id) {
      void cancelSession(id).catch(e =>
        console.warn('[RiskEval] cancelSession failed (already terminal?):', e),
      );
    }
    try {
      stopAudioStream();
    } catch {
      /* ignore */
    }
    navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
  }, [navigation]);

  const failed = phase === 'failed';

  return (
    <ScreenContainer
      testID="risk-eval-screen"
      scroll
      contentStyle={styles.content}
      footer={
        failed ? (
          <View style={styles.footerStack}>
            <PrimaryButton
              testID="risk-eval-continue"
              label={tr('common.continue')}
              onPress={goToDecisionUnavailable}
              accessibilityHint={tr('session.unavailableBody')}
            />
            <SecondaryButton
              testID="risk-eval-retry"
              label={tr('common.retry')}
              onPress={handleRetry}
              style={styles.footerGap}
            />
          </View>
        ) : (
          <SecondaryButton
            testID="risk-eval-cancel"
            label={tr('risk.common.cancel')}
            tone="danger"
            variant="ghost"
            onPress={handleCancel}
            accessibilityHint={tr('risk.common.cancel')}
          />
        )
      }
    >
      <Animated.View style={{ opacity: fade }}>
        <View style={styles.indicatorRow}>
          <ProtectionSessionIndicator
            testID="protection-session-indicator"
            state={failed ? 'complete' : 'evaluating'}
            label={tr('session.active')}
            animate={!failed}
          />
        </View>

        <View style={styles.hero}>
          <ShieldGlyph
            size={sf(64)}
            halo
            glyph="🛡"
            color={failed ? theme.risk.warning.main : theme.brand.blue}
            haloColor={failed ? theme.risk.warning.soft : theme.brand.blueSoft}
          />
        </View>

        <Text
          testID="checking-label"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          allowFontScaling={false}
          style={[
            styles.title,
            { fontSize: sf(theme.typography.h1.size), lineHeight: sf(theme.typography.h1.lineHeight) },
          ]}
        >
          {failed ? tr('session.unavailable') : tr('session.evaluating')}
        </Text>

        <Text
          allowFontScaling={false}
          style={[
            styles.subtitle,
            { fontSize: sf(theme.typography.body.size), lineHeight: sf(theme.typography.body.lineHeight) },
          ]}
        >
          {failed ? tr('session.unavailableBody') : tr('session.checking')}
        </Text>

        {failed ? (
          <SecurityAlert
            testID="risk-eval-unavailable"
            tone="warning"
            title={tr('session.unavailable')}
            message={tr('session.unavailableBody')}
            style={styles.alert}
          />
        ) : (
          <View
            testID="risk-progress-bar"
            accessible
            accessibilityRole="progressbar"
            accessibilityLabel={tr('session.evaluating')}
            accessibilityValue={{ text: tr('session.checking') }}
            style={styles.progressTrack}
          >
            <Animated.View style={[styles.progressFill, { width: progressWidth }]} />
          </View>
        )}

        <Card
          testID="risk-eval-summary"
          style={styles.summary}
          accessibilityLabel={`${formatINRCompact(amount)}. ${beneficiary.name}. ${beneficiary.upiId}`}
        >
          <Text
            allowFontScaling={false}
            style={[styles.summaryLabel, { fontSize: sf(theme.typography.tiny.size) }]}
          >
            {tr('activity.amount')}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.summaryAmount, { fontSize: sf(theme.typography.amount.size), lineHeight: sf(theme.typography.amount.lineHeight) }]}
          >
            {formatINRCompact(amount)}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.summaryPayee, { fontSize: sf(theme.typography.bodyBold.size) }]}
          >
            {beneficiary.name}
          </Text>
          <Text
            allowFontScaling={false}
            style={[styles.summaryUpi, { fontSize: sf(theme.typography.caption.size) }]}
          >
            {beneficiary.upiId}
          </Text>
        </Card>
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: theme.spacing.xxl,
  },
  indicatorRow: {
    alignItems: 'center',
    marginBottom: theme.spacing.xxl,
  },
  hero: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  subtitle: {
    color: theme.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xxl,
  },
  alert: {
    marginBottom: theme.spacing.xxl,
  },
  progressTrack: {
    height: 10,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.neutral.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.neutral.border,
    overflow: 'hidden',
    marginBottom: theme.spacing.xxl,
  },
  progressFill: {
    height: '100%',
    borderRadius: theme.radius.sm,
    backgroundColor: theme.brand.blue,
  },
  summary: {
    alignItems: 'center',
  },
  summaryLabel: {
    color: theme.neutral.textMuted,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.xs,
  },
  summaryAmount: {
    color: theme.brand.navy,
    fontWeight: '700',
  },
  summaryPayee: {
    color: theme.neutral.textPrimary,
    fontWeight: '600',
    marginTop: theme.spacing.sm,
  },
  summaryUpi: {
    color: theme.neutral.textSecondary,
    marginTop: 2,
  },
  footerStack: {
    width: '100%',
  },
  footerGap: {
    marginTop: theme.spacing.md,
  },
});

export default RiskEvalScreen;
