/**
 * GuardPay AI — TransactionDetailScreen  ·  product spec §23
 *
 * The full record of one protected payment: what was paid, what the engine
 * decided, which signals drove that decision, and whether the payment was
 * verified.
 *
 * §38: evidence is reported as a *status* only. The bundle id, the cipher, the
 *      key handling — none of it is surfaced to the user. "Security evidence
 *      preserved" is the entire disclosure.
 * §13: the tier is resolved through `resolveTier()`; no thresholds appear here.
 * §41: a failed fetch falls back to the record handed over by the list screen,
 *      and only shows an error when there is nothing at all to render.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  AppHeader,
  Card,
  RiskTierBadge,
  ScreenContainer,
  SecondaryButton,
  SecurityAlert,
  WhatWeCheckedList,
} from '../components/guardpay';
import type { WhatWeCheckedFactor } from '../components/guardpay';
import { resolveTier } from '../config/riskTiers';
import type { RiskTierId } from '../config/riskTiers';
import { useScaledFont, useSeniorMode } from '../context/SeniorModeContext';
import { ApiError, getTransaction } from '../services/api';
import type { RiskDecision, RiskFactorDto, TransactionRecord } from '../services/api';
import { formatINR } from '../services/format';
import theme from '../theme';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'TransactionDetail'>;

const TIER_BADGE_KEY: Record<RiskTierId, string> = {
  SAFE: 'risk.badge.safe',
  WARNING: 'risk.badge.warning',
  HOLD: 'risk.badge.hold',
  INTERCEPT: 'risk.badge.intercept',
};

const DECISION_BADGE_KEY: Record<RiskDecision, string> = {
  ALLOW: 'risk.badge.safe',
  WARN: 'risk.badge.warning',
  HOLD: 'risk.badge.hold',
  BLOCK: 'risk.badge.intercept',
};

/** Backend verification vocabulary that counts as "the user verified this". */
const VERIFIED_STATES = ['passed', 'verified', 'success', 'succeeded', 'true'];

function formatLongTimestamp(iso: string | undefined): string {
  if (!iso) return '';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  const d = new Date(parsed);
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

function toCheckedFactors(
  factors: RiskFactorDto[] | undefined,
  severityLabel: (severity: RiskFactorDto['severity']) => string,
): WhatWeCheckedFactor[] {
  if (!Array.isArray(factors)) return [];
  return factors.map(f => ({
    factor: f.name,
    points: typeof f.score === 'number' ? f.score : undefined,
    severity: f.severity,
    explanation: f.explanation,
    severityLabel: f.severity ? severityLabel(f.severity) : undefined,
    technical: f.technical,
  }));
}

export function TransactionDetailScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const sf = useScaledFont();
  const { fontScale, isSeniorMode } = useSeniorMode();

  const { transactionId, record: seededRecord } = route.params;

  const [record, setRecord] = useState<TransactionRecord | null>(seededRecord ?? null);
  const [loading, setLoading] = useState(!seededRecord);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      const fresh = await getTransaction(transactionId);
      if (fresh) setRecord(fresh);
    } catch (err) {
      // §41: the seeded record from the list keeps the screen useful offline.
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : t('common.offlineBody', {
              defaultValue: 'GuardPay could not reach the server.',
            }),
      );
    } finally {
      setLoading(false);
    }
  }, [t, transactionId]);

  useEffect(() => {
    load();
  }, [load]);

  const severityLabel = useCallback(
    (severity: RiskFactorDto['severity']) => t(`risk.severity.${severity}`),
    [t],
  );

  const factors = useMemo(
    () => toCheckedFactors(record?.factors, severityLabel),
    [record, severityLabel],
  );

  const tier: RiskTierId | null = record
    ? resolveTier(record.risk_tier, record.risk_score ?? 0)
    : null;

  const unavailableText = t('common.unavailable', { defaultValue: 'Unavailable' });

  const decisionLabel = record?.decision
    ? t(DECISION_BADGE_KEY[record.decision])
    : tier
      ? t(TIER_BADGE_KEY[tier])
      : unavailableText;

  const verificationStatus = (record?.verification_status ?? '').toLowerCase();
  const verified = VERIFIED_STATES.indexOf(verificationStatus) !== -1;
  const verificationLabel = verificationStatus
    ? verified
      ? t('activity.verified')
      : t('activity.notVerified')
    : t('activity.notVerified');

  const evidencePreserved = Boolean(record?.evidence_bundle_id);

  const renderRow = (label: string, value: string, testID: string) => (
    <View
      key={testID}
      testID={testID}
      style={styles.row}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text
        allowFontScaling={false}
        style={[styles.rowLabel, { fontSize: sf(theme.typography.caption.size) }]}
      >
        {label}
      </Text>
      <Text
        allowFontScaling={false}
        style={[styles.rowValue, { fontSize: sf(theme.typography.bodyBold.size) }]}
      >
        {value}
      </Text>
    </View>
  );

  // ── Nothing to show at all ────────────────────────────────────────────────
  if (!record) {
    return (
      <ScreenContainer testID="txn-detail-screen" padded={false}>
        <AppHeader
          testID="txn-detail-header"
          title={t('activity.detailTitle')}
          onBack={() => navigation.goBack()}
          backAccessibilityLabel={t('risk.common.back')}
          backAccessibilityHint={t('activity.title')}
          fontScale={fontScale}
          style={styles.header}
        />
        <View style={styles.centre}>
          {loading ? (
            <>
              <ActivityIndicator size="large" color={theme.brand.blue} />
              <Text
                allowFontScaling={false}
                style={[styles.helper, { fontSize: sf(theme.typography.body.size) }]}
              >
                {t('common.loading')}
              </Text>
            </>
          ) : (
            <SecurityAlert
              testID="txn-detail-error"
              tone="warning"
              title={t('common.errorTitle', { defaultValue: 'Could not load this payment' })}
              message={errorMessage ?? unavailableText}
              actionLabel={t('common.retry')}
              onActionPress={load}
              actionAccessibilityHint={t('activity.detailTitle')}
              fontScale={fontScale}
            />
          )}
        </View>
      </ScreenContainer>
    );
  }

  const beneficiaryName = record.beneficiary_name || record.receiver_upi_id;

  return (
    <ScreenContainer
      testID="txn-detail-screen"
      scroll
      padded={false}
      contentStyle={styles.content}
      footer={
        <SecondaryButton
          testID="txn-detail-close"
          label={t('common.close')}
          onPress={() => navigation.goBack()}
          accessibilityHint={t('activity.title')}
          fontScale={fontScale}
        />
      }
    >
      <AppHeader
        testID="txn-detail-header"
        title={t('activity.detailTitle')}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t('risk.common.back')}
        backAccessibilityHint={t('activity.title')}
        right={
          tier ? (
            <RiskTierBadge
              testID="txn-detail-tier"
              tier={tier}
              label={t(TIER_BADGE_KEY[tier])}
              size="sm"
              fontScale={fontScale}
            />
          ) : undefined
        }
        fontScale={fontScale}
        style={styles.header}
      />

      <View style={styles.gutter}>
        {errorMessage ? (
          <SecurityAlert
            testID="txn-detail-stale"
            tone="info"
            title={t('common.errorTitle', { defaultValue: 'Showing the last known details' })}
            message={errorMessage}
            actionLabel={t('common.retry')}
            onActionPress={load}
            actionAccessibilityHint={t('activity.detailTitle')}
            compact
            fontScale={fontScale}
            style={styles.block}
          />
        ) : null}

        {/* ── Headline amount ──────────────────────────────────────────── */}
        <Card testID="txn-detail-amount" style={styles.block}>
          <Text
            allowFontScaling={false}
            style={[styles.rowLabel, { fontSize: sf(theme.typography.caption.size) }]}
          >
            {t('activity.amount')}
          </Text>
          <Text
            allowFontScaling={false}
            accessibilityRole="header"
            style={[styles.amount, { fontSize: sf(theme.typography.amount.size) }]}
          >
            {formatINR(record.amount)}
          </Text>

          {renderRow(t('activity.beneficiary'), beneficiaryName, 'txn-detail-beneficiary')}
          {renderRow(t('payment.upiLabel'), record.receiver_upi_id, 'txn-detail-upi')}
          {renderRow(
            t('activity.time'),
            formatLongTimestamp(record.created_at) || unavailableText,
            'txn-detail-time',
          )}
          {renderRow(t('success.txnId'), record.transaction_id, 'txn-detail-id')}
        </Card>

        {/* ── Decision ─────────────────────────────────────────────────── */}
        <Card testID="txn-detail-decision" style={styles.block}>
          <Text
            allowFontScaling={false}
            accessibilityRole="header"
            style={[styles.sectionTitle, { fontSize: sf(theme.typography.h3.size) }]}
          >
            {t('activity.decision')}
          </Text>

          <View style={styles.decisionRow}>
            {tier ? (
              <RiskTierBadge
                testID="txn-detail-decision-badge"
                tier={tier}
                label={decisionLabel}
                size="md"
                fontScale={fontScale}
              />
            ) : (
              <Text
                allowFontScaling={false}
                style={[styles.rowValue, { fontSize: sf(theme.typography.bodyBold.size) }]}
              >
                {decisionLabel}
              </Text>
            )}
          </View>

          {renderRow(
            t('risk.scoreLabel'),
            typeof record.risk_score === 'number'
              ? `${Math.round(record.risk_score)} ${t('risk.outOf')}`
              : unavailableText,
            'txn-detail-score',
          )}
          {renderRow(t('activity.verification'), verificationLabel, 'txn-detail-verification')}
          {renderRow(
            t('activity.evidence'),
            evidencePreserved ? t('activity.preserved') : t('activity.notVerified'),
            'txn-detail-evidence-row',
          )}
        </Card>

        {/* ── Detected factors ─────────────────────────────────────────── */}
        <WhatWeCheckedList
          testID="txn-detail-factors"
          factors={factors}
          title={t('risk.whatWeChecked')}
          technicalLabel={t('risk.technicalDetails')}
          technicalHint={t('risk.whyFlagged')}
          hidePoints={isSeniorMode}
          emptyLabel={t('activity.notVerified')}
          severityLabels={{
            normal: t('risk.severity.normal'),
            unusual: t('risk.severity.unusual'),
            suspicious: t('risk.severity.suspicious'),
            critical: t('risk.severity.critical'),
          }}
          fontScale={fontScale}
          style={styles.block}
        />

        {/* ── Evidence status only — never the bundle itself (§38) ─────── */}
        {evidencePreserved ? (
          <SecurityAlert
            testID="txn-detail-evidence"
            tone="success"
            title={t('risk.evidenceSaved')}
            message={t('risk.alertSent')}
            fontScale={fontScale}
            style={styles.block}
          />
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing.xxl },
  header: { paddingHorizontal: theme.spacing.xl },
  gutter: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.lg },
  block: { marginBottom: theme.spacing.lg },
  amount: {
    color: theme.neutral.textPrimary,
    fontWeight: theme.typography.amount.weight,
    marginBottom: theme.spacing.lg,
  },
  sectionTitle: {
    color: theme.neutral.textPrimary,
    fontWeight: theme.typography.h3.weight,
    marginBottom: theme.spacing.md,
  },
  decisionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: theme.spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: theme.control.minTouch,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.neutral.border,
    paddingVertical: theme.spacing.sm,
  },
  rowLabel: { color: theme.neutral.textSecondary, flexShrink: 0, marginRight: theme.spacing.lg },
  rowValue: {
    color: theme.neutral.textPrimary,
    fontWeight: theme.typography.bodyBold.weight,
    flexShrink: 1,
    textAlign: 'right',
  },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xl,
  },
  helper: { color: theme.neutral.textSecondary, marginTop: theme.spacing.md },
});

export default TransactionDetailScreen;
