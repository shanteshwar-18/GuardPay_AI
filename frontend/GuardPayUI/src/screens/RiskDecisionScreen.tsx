/**
 * GuardPay AI — RiskDecisionScreen (§14–§18, §45)
 *
 * ONE data-driven screen for all four tiers, replacing the former separate
 * Warning / Hold / Intercept screens. Every difference between the tiers —
 * headline, description, colour, glyph, CTA labels, where the primary CTA goes
 * and whether the PIN pad is reachable at all — is read from
 * config/riskTiers.ts::getTierConfig(). Nothing tier-specific is hardcoded here.
 *
 * The PIN gate (§17, §37, §53):
 *   • The primary CTA follows `cfg.primaryRoute`. For INTERCEPT that is
 *     'TrustedContact', never 'Pin'.
 *   • Even so, the 'Pin' branch is additionally guarded by isPinReachable(),
 *     which returns false for INTERCEPT under every condition.
 *   • Android hardware back and the swipe-back gesture are blocked on INTERCEPT
 *     so a blocked payment cannot be walked backwards into an older stack entry.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, BackHandler, Easing, StyleSheet, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  Card,
  PrimaryButton,
  RiskGauge,
  RiskTierBadge,
  ScreenContainer,
  SecondaryButton,
  SecurityAlert,
  WhatWeCheckedList,
  useFontScale,
} from '../components/guardpay';
import type { WhatWeCheckedFactor } from '../components/guardpay';
import type { FactorSeverity } from '../components/guardpay';
import { theme } from '../theme';
import { getTierConfig, isPinReachable } from '../config/riskTiers';
import { cancelSession } from '../services/api';
import { formatINRCompact } from '../services/format';
import { useSeniorMode } from '../context/SeniorModeContext';
import { useLanguage, toLang } from '../services/languageState';
import { speak, stopSpeaking } from '../services/tts';
import { simplifyExplanation } from '../i18n/simplifiedStrings';
import { notifyRiskDecision } from '../services/notifications';
import type { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'RiskDecision'>;

const SEVERITY_KEYS: FactorSeverity[] = ['normal', 'unusual', 'suspicious', 'critical'];

export function RiskDecisionScreen({ route, navigation }: Props) {
  const {
    sessionId,
    transactionId,
    beneficiary,
    amount,
    note,
    tier,
    riskScore,
    factors,
    evidenceBundleId,
  } = route.params;

  const { t } = useTranslation();
  const tr = useCallback(
    (key: string, opts?: Record<string, unknown>): string => String(t(key, opts ?? {})),
    [t],
  );
  const { isSeniorMode } = useSeniorMode();
  const { sf } = useFontScale();
  const { currentLanguage } = useLanguage();

  const cfg = getTierConfig(tier);
  const isIntercept = tier === 'INTERCEPT';

  const [cancelling, setCancelling] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const fade = useRef(new Animated.Value(0)).current;
  const rise = useRef(new Animated.Value(12)).current;

  // ── Copy (senior mode swaps in the simplified, louder variants, §25) ───────
  const headline = isSeniorMode ? tr(cfg.seniorTitleKey) : tr(cfg.titleKey);
  const description = isSeniorMode ? tr(cfg.seniorDescriptionKey) : tr(cfg.descriptionKey);
  const tierWord = tr(cfg.badgeLabelKey);

  // ── Entrance animation, stopped on unmount (§47) ───────────────────────────
  useEffect(() => {
    const anim = Animated.parallel([
      Animated.timing(fade, {
        toValue: 1,
        duration: 320,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(rise, {
        toValue: 0,
        duration: 320,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [fade, rise]);

  // ── Auto voice alert for every non-SAFE decision (§24) ─────────────────────
  useEffect(() => {
    if (tier === 'SAFE') return undefined;
    void speak(`${headline}. ${description}`, toLang(currentLanguage));
    return () => {
      void stopSpeaking();
    };
  }, [tier, headline, description, currentLanguage]);

  // ── Real device notification for the same decision (spec: "To show real-time
  // risk and security alerts" — the stated purpose of the Notifications
  // permission). Fires once per mount; a denied/unsupported permission
  // degrades silently, it never blocks the on-screen decision. ────────────────
  useEffect(() => {
    if (tier === 'SAFE') return;
    void notifyRiskDecision(tier, amount, beneficiary.name || beneficiary.upiId);
  }, [tier, amount, beneficiary.name, beneficiary.upiId]);

  // ── INTERCEPT: no way backwards out of a blocked payment ───────────────────
  useEffect(() => {
    if (!isIntercept) return undefined;
    navigation.setOptions({ gestureEnabled: false });
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [isIntercept, navigation]);

  // ── "What we checked" rows from the backend factors[] (§18) ────────────────
  const checkedFactors: WhatWeCheckedFactor[] = useMemo(
    () =>
      (factors ?? []).map(f => ({
        factor: f.name,
        points: typeof f.score === 'number' ? f.score : undefined,
        severity: f.severity,
        // Plain language up front; senior mode rewrites SHAP-speak into a sentence.
        explanation: f.explanation
          ? isSeniorMode
            ? simplifyExplanation(f.explanation)
            : f.explanation
          : undefined,
        // Technical detail stays collapsed behind the disclosure.
        technical: f.technical,
      })),
    [factors, isSeniorMode],
  );

  const severityLabels = useMemo(() => {
    const out: Partial<Record<FactorSeverity, string>> = {};
    SEVERITY_KEYS.forEach(k => {
      out[k] = tr(`risk.severity.${k}`);
    });
    return out;
  }, [tr]);

  // ── Primary CTA — routing comes from the tier config, never from a switch ──
  const handlePrimary = useCallback(() => {
    const target = cfg.primaryRoute;
    if (!target) return;

    const session = { sessionId, transactionId, beneficiary, amount, note };

    if (target === 'Pin') {
      // Central authorization guard. Defence in depth: even if a config change
      // ever pointed INTERCEPT at 'Pin', this refuses the transition.
      if (!isPinReachable(tier, false)) {
        setErrorText(tr('risk.intercept.advice'));
        return;
      }
      navigation.navigate('Pin', { ...session, tier, riskScore, verified: false });
      return;
    }

    if (target === 'TrustedContact') {
      navigation.navigate('TrustedContact', { ...session, tier, riskScore });
      return;
    }

    navigation.navigate('VerificationCode', {
      ...session,
      tier,
      riskScore,
      origin: 'warning',
    });
  }, [
    cfg.primaryRoute,
    sessionId,
    transactionId,
    beneficiary,
    amount,
    note,
    tier,
    riskScore,
    navigation,
    tr,
  ]);

  // ── Secondary CTA — cancel the session, then home ──────────────────────────
  const handleCancel = useCallback(async () => {
    if (cancelling) return;
    setCancelling(true);
    setErrorText(null);
    try {
      await cancelSession(sessionId);
    } catch (err) {
      // A cancel that cannot reach the backend must still take the user out of
      // the payment; the session expires server-side.
      console.warn('[RiskDecision] cancelSession failed:', err);
    } finally {
      void stopSpeaking();
      navigation.reset({ index: 0, routes: [{ name: 'Home' }] });
    }
  }, [cancelling, sessionId, navigation]);

  const gaugeCaption = isSeniorMode
    ? undefined
    : `${tr('risk.scoreLabel')} ${riskScore}${tr('risk.outOf')}`;

  return (
    <ScreenContainer
      testID="risk-decision-screen"
      scroll
      contentStyle={styles.content}
      footer={
        <View>
          {cfg.primaryRoute ? (
            <PrimaryButton
              testID="risk-decision-primary"
              label={tr(cfg.primaryCtaKey)}
              tone={isIntercept ? 'danger' : 'primary'}
              onPress={handlePrimary}
              accessibilityHint={description}
            />
          ) : null}
          <SecondaryButton
            testID="risk-decision-cancel"
            label={tr(cfg.secondaryCtaKey)}
            tone="danger"
            variant="ghost"
            loading={cancelling}
            onPress={handleCancel}
            accessibilityHint={tr('risk.common.cancel')}
            style={cfg.primaryRoute ? styles.footerGap : undefined}
          />
        </View>
      }
    >
      <Animated.View style={{ opacity: fade, transform: [{ translateY: rise }] }}>
        {/* Tier is stated as a word + glyph as well as colour (§48). */}
        <View style={styles.badgeRow}>
          <RiskTierBadge
            testID="risk-decision-badge"
            tier={tier}
            size="lg"
            label={tierWord}
          />
        </View>

        <View style={styles.gaugeWrap}>
          <RiskGauge
            testID="risk-decision-gauge"
            score={riskScore}
            tier={tier}
            // Senior mode: colour + word only, digits are suppressed (§25).
            hideNumber={isSeniorMode}
            label={tierWord}
            caption={gaugeCaption}
          />
        </View>

        <Text
          testID="risk-decision-title"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
          allowFontScaling={false}
          style={[
            styles.title,
            {
              color: cfg.darkColor,
              fontSize: sf(theme.typography.h1.size),
              lineHeight: sf(theme.typography.h1.lineHeight),
            },
          ]}
        >
          {headline}
        </Text>

        <Text
          testID="risk-decision-description"
          allowFontScaling={false}
          style={[
            styles.description,
            {
              fontSize: sf(theme.typography.body.size),
              lineHeight: sf(theme.typography.body.lineHeight),
            },
          ]}
        >
          {description}
        </Text>

        {/* Payment under review */}
        <Card testID="risk-decision-payment" style={styles.paymentCard}>
          <View style={styles.paymentRow}>
            <Text
              allowFontScaling={false}
              style={[styles.paymentLabel, { fontSize: sf(theme.typography.caption.size) }]}
            >
              {tr('activity.amount')}
            </Text>
            <Text
              allowFontScaling={false}
              style={[styles.paymentValue, { fontSize: sf(theme.typography.bodyBold.size) }]}
            >
              {formatINRCompact(amount)}
            </Text>
          </View>
          <View style={[styles.paymentRow, styles.paymentRowLast]}>
            <Text
              allowFontScaling={false}
              style={[styles.paymentLabel, { fontSize: sf(theme.typography.caption.size) }]}
            >
              {tr('activity.beneficiary')}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[styles.paymentValue, styles.paymentValueRight, { fontSize: sf(theme.typography.bodyBold.size) }]}
            >
              {beneficiary.name}
            </Text>
          </View>
        </Card>

        {/* INTERCEPT security advice — spelled out, not implied by colour. */}
        {isIntercept ? (
          <SecurityAlert
            testID="risk-decision-advice"
            tone="danger"
            title={tr('risk.intercept.advice')}
            message={tr('risk.alertSent')}
            style={styles.alert}
          />
        ) : null}

        {evidenceBundleId ? (
          <SecurityAlert
            testID="risk-decision-evidence"
            tone="info"
            title={tr('risk.evidenceSaved')}
            message={evidenceBundleId}
            compact
            style={styles.alert}
          />
        ) : null}

        {errorText ? (
          <SecurityAlert
            testID="risk-decision-error"
            tone="danger"
            title={errorText}
            style={styles.alert}
          />
        ) : null}

        <WhatWeCheckedList
          testID="risk-decision-factors"
          factors={checkedFactors}
          title={tr('risk.whatWeChecked')}
          technicalLabel={tr('risk.technicalDetails')}
          technicalHint={tr('risk.whyFlagged')}
          // Senior mode hides every numeric weight alongside the score itself.
          hidePoints={isSeniorMode}
          showTechnical={!isSeniorMode}
          severityLabels={severityLabels}
          emptyLabel={tr('session.unavailableBody')}
          style={styles.factors}
        />
      </Animated.View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: theme.spacing.xl,
  },
  badgeRow: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
  },
  gaugeWrap: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: theme.spacing.sm,
  },
  description: {
    color: theme.neutral.textSecondary,
    textAlign: 'center',
    marginBottom: theme.spacing.xl,
  },
  paymentCard: {
    marginBottom: theme.spacing.lg,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: theme.spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.neutral.border,
  },
  paymentRowLast: {
    borderBottomWidth: 0,
  },
  paymentLabel: {
    color: theme.neutral.textSecondary,
    flexShrink: 0,
    marginRight: theme.spacing.lg,
  },
  paymentValue: {
    color: theme.neutral.textPrimary,
    fontWeight: '700',
  },
  paymentValueRight: {
    flexShrink: 1,
    textAlign: 'right',
  },
  alert: {
    marginBottom: theme.spacing.lg,
  },
  factors: {
    marginTop: theme.spacing.sm,
  },
  footerGap: {
    marginTop: theme.spacing.md,
  },
});

export default RiskDecisionScreen;
