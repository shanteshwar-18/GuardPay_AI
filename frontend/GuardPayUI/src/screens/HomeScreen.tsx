/**
 * GuardPay AI — HomeScreen (Dashboard)  ·  product spec §9
 *
 * The idle entry point of the app: protection status, a protection summary
 * computed from REAL transaction history, recent activity, and the primary
 * "Send Money" call to action.
 *
 * Hard rules honoured here:
 *   • §9  — the three summary metrics are derived from `listTransactions()`.
 *           Nothing on this screen is a hardcoded count.
 *   • §13 — tiers come from `resolveTier()`; no threshold literals live here.
 *   • §41 — the screen must render when the backend is unreachable. In that
 *           case the summary reads "unavailable" (never an invented number)
 *           and the recent list degrades to the local sample data, labelled
 *           as such.
 *   • §26 — every string comes from i18n.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  BottomNavigation,
  Card,
  EmptyState,
  GuardPayLogo,
  PrimaryButton,
  ScreenContainer,
  SecurityAlert,
  SecurityStatusCard,
  TransactionCard,
} from '../components/guardpay';
import type { BottomNavTabKey } from '../components/guardpay';
import { resolveTier } from '../config/riskTiers';
import type { RiskTierId } from '../config/riskTiers';
import { useScaledFont, useSeniorMode } from '../context/SeniorModeContext';
import { MOCK_LANGUAGES, MOCK_RECENT_TRANSACTIONS } from '../mock/mockData';
import { ApiError, listTransactions } from '../services/api';
import type { TransactionRecord } from '../services/api';
import { formatINRCompact } from '../services/format';
import { useLanguage } from '../services/languageState';
import type { SupportedLanguage } from '../i18n/translations';
import theme from '../theme';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

/** Persisted by SettingsScreen; read here so the status card tells the truth. */
const ACTIVE_PROTECTION_KEY = 'guardpay:activeProtection';

const RECENT_LIMIT = 5;

/** Tier -> already-existing i18n badge key. Never derive a threshold locally. */
const TIER_BADGE_KEY: Record<RiskTierId, string> = {
  SAFE: 'risk.badge.safe',
  WARNING: 'risk.badge.warning',
  HOLD: 'risk.badge.hold',
  INTERCEPT: 'risk.badge.intercept',
};

interface ProtectionSummary {
  /** Every payment that passed through a protected session. */
  paymentsProtected: number;
  /** Payments the engine flagged as WARNING. */
  alerts: number;
  /** Payments GuardPay actually stepped into — HOLD or INTERCEPT. */
  interventions: number;
}

/** Does this record carry any risk information at all? */
function hasRiskData(txn: TransactionRecord): boolean {
  return txn.risk_tier != null || typeof txn.risk_score === 'number';
}

function tierOf(txn: TransactionRecord): RiskTierId {
  return resolveTier(txn.risk_tier, txn.risk_score ?? 0);
}

function timeValue(iso: string | undefined): number {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

/** Short, locale-independent timestamp. Falls back to the raw string. */
function formatShortTimestamp(iso: string | undefined): string {
  if (!iso) return '';
  const parsed = Date.parse(iso);
  if (Number.isNaN(parsed)) return iso;
  const d = new Date(parsed);
  try {
    return new Intl.DateTimeFormat(undefined, {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }
}

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const sf = useScaledFont();
  const { fontScale, isSeniorMode, toggleSeniorMode } = useSeniorMode();
  const { currentLanguage, setLanguage } = useLanguage();

  const [transactions, setTransactions] = useState<TransactionRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeProtection, setActiveProtection] = useState(true);

  // ── Data load (§41: never throws out of the screen) ────────────────────────
  const load = useCallback(async () => {
    setLoading(true);
    setErrorMessage(null);
    try {
      // NOTE: this endpoint returns a bare array, not an envelope object.
      const res = await listTransactions('all');
      setTransactions(Array.isArray(res) ? res : []);
    } catch (err) {
      setTransactions(null);
      setErrorMessage(
        err instanceof ApiError
          ? err.message
          : t('common.offlineBody', {
              defaultValue: 'GuardPay could not reach the server. Showing sample data.',
            }),
      );
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    load();
  }, [load]);

  // Settings can flip Active Protection while this screen is mounted.
  useEffect(() => {
    let cancelled = false;
    const hydrate = async () => {
      try {
        const stored = await AsyncStorage.getItem(ACTIVE_PROTECTION_KEY);
        if (!cancelled) setActiveProtection(stored !== 'false');
      } catch {
        if (!cancelled) setActiveProtection(true);
      }
    };
    hydrate();
    const unsubscribe = navigation.addListener('focus', hydrate);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [navigation]);

  // ── Derived data ───────────────────────────────────────────────────────────
  const summary: ProtectionSummary | null = useMemo(() => {
    if (!transactions) return null;
    return transactions.reduce<ProtectionSummary>(
      (acc, txn) => {
        acc.paymentsProtected += 1;
        if (!hasRiskData(txn)) return acc;
        const tier = tierOf(txn);
        if (tier === 'WARNING') acc.alerts += 1;
        if (tier === 'HOLD' || tier === 'INTERCEPT') acc.interventions += 1;
        return acc;
      },
      { paymentsProtected: 0, alerts: 0, interventions: 0 },
    );
  }, [transactions]);

  const recent = useMemo(() => {
    if (!transactions) return [];
    return transactions
      .slice()
      .sort((a, b) => timeValue(b.created_at) - timeValue(a.created_at))
      .slice(0, RECENT_LIMIT);
  }, [transactions]);

  const offline = transactions === null && !loading;

  // ── Handlers ───────────────────────────────────────────────────────────────
  const onNavigate = useCallback(
    (tab: BottomNavTabKey) => {
      switch (tab) {
        case 'home':
          return;
        case 'activity':
          navigation.navigate('Activity');
          return;
        case 'protection':
          navigation.navigate('Permissions', { fromSettings: true });
          return;
        case 'contacts':
          navigation.navigate('TrustedContacts');
          return;
        case 'settings':
          navigation.navigate('Settings');
          return;
        default:
          return;
      }
    },
    [navigation],
  );

  const navLabels: Record<BottomNavTabKey, string> = {
    home: t('nav.home'),
    activity: t('nav.activity'),
    protection: t('nav.protection'),
    contacts: t('nav.contacts'),
    settings: t('nav.settings'),
  };

  const unavailableText = t('common.unavailable', { defaultValue: 'Unavailable' });

  // ── Sub-renders ────────────────────────────────────────────────────────────
  const renderMetric = (labelKey: string, value: number | null, testID: string) => {
    const shown = value === null ? '—' : String(value);
    const label = t(labelKey);
    return (
      <View
        key={testID}
        testID={testID}
        style={styles.metric}
        accessible
        accessibilityRole="text"
        accessibilityLabel={`${label}: ${value === null ? unavailableText : shown}`}
      >
        <Text allowFontScaling={false} style={[styles.metricValue, { fontSize: sf(theme.typography.h1.size) }]}>
          {shown}
        </Text>
        <Text
          allowFontScaling={false}
          style={[styles.metricLabel, { fontSize: sf(theme.typography.tiny.size) }]}
        >
          {label}
        </Text>
      </View>
    );
  };

  const renderRecent = () => {
    if (loading) {
      return (
        <Text
          allowFontScaling={false}
          style={[styles.helper, { fontSize: sf(theme.typography.body.size) }]}
          accessibilityRole="text"
        >
          {t('common.loading')}
        </Text>
      );
    }

    // Backend unreachable — degrade to the local sample rows, clearly labelled.
    if (offline) {
      return (
        <View>
          {MOCK_RECENT_TRANSACTIONS.slice(0, RECENT_LIMIT).map(item => (
            <TransactionCard
              key={item.id}
              testID={`home-sample-${item.id}`}
              name={item.name}
              upiId={item.upiId}
              amount={formatINRCompact(item.amount)}
              isCredit={!item.isDebit}
              timestamp={item.date}
              statusLabel={unavailableText}
              fontScale={fontScale}
              style={styles.rowGap}
            />
          ))}
        </View>
      );
    }

    if (recent.length === 0) {
      return (
        <EmptyState
          testID="home-empty"
          icon="🛡"
          title={t('dashboard.noActivity')}
          message={t('dashboard.noActivityBody')}
          ctaLabel={t('dashboard.sendMoney')}
          onCtaPress={() => navigation.navigate('Payment')}
          ctaAccessibilityHint={t('payment.title')}
          compact
          fontScale={fontScale}
        />
      );
    }

    return (
      <View>
        {recent.map(txn => {
          const showRisk = hasRiskData(txn);
          const tier = showRisk ? tierOf(txn) : undefined;
          return (
            <TransactionCard
              key={txn.transaction_id}
              testID={`home-txn-${txn.transaction_id}`}
              name={txn.beneficiary_name || txn.receiver_upi_id}
              upiId={txn.receiver_upi_id}
              amount={formatINRCompact(txn.amount)}
              timestamp={formatShortTimestamp(txn.created_at)}
              tier={tier}
              statusLabel={tier ? t(TIER_BADGE_KEY[tier]) : unavailableText}
              onPress={() =>
                navigation.navigate('TransactionDetail', {
                  transactionId: txn.transaction_id,
                  record: txn,
                })
              }
              accessibilityHint={t('activity.detailTitle')}
              fontScale={fontScale}
              style={styles.rowGap}
            />
          );
        })}
      </View>
    );
  };

  return (
    <ScreenContainer
      testID="home-screen"
      scroll
      padded={false}
      contentStyle={styles.content}
      footer={
        <BottomNavigation
          testID="home-bottom-nav"
          active="home"
          onNavigate={onNavigate}
          labels={navLabels}
          hints={{
            activity: t('activity.emptyBody'),
            settings: t('settings.title'),
            contacts: t('settings.trustedContacts'),
          }}
          fontScale={fontScale}
          style={styles.bottomNav}
        />
      }
    >
        {/* ── Top bar ────────────────────────────────────────────────────── */}
        <View style={styles.topBar}>
          <GuardPayLogo size="sm" variant="light" fontScale={fontScale} testID="home-logo" />
          <Pressable
            testID="home-notifications"
            onPress={() => navigation.navigate('Activity')}
            accessible
            accessibilityRole="button"
            accessibilityLabel={t('dashboard.notifications', { defaultValue: 'Notifications' })}
            accessibilityHint={t('activity.title')}
            style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
          >
            <Text allowFontScaling={false} style={[styles.iconGlyph, { fontSize: sf(theme.control.iconSm) }]}>
              🔔
            </Text>
          </Pressable>
        </View>

        {/* ── Protection status ──────────────────────────────────────────── */}
        <SecurityStatusCard
          testID="home-status"
          title={activeProtection ? t('dashboard.protected') : t('dashboard.inactive')}
          subtitle={activeProtection ? t('dashboard.protectedSub') : t('dashboard.inactiveSub')}
          tone={activeProtection ? 'protected' : 'inactive'}
          statusLabel={activeProtection ? t('settings.on') : t('settings.off')}
          fontScale={fontScale}
          style={styles.block}
        />

        {/* ── Error banner (§41) ─────────────────────────────────────────── */}
        {errorMessage ? (
          <SecurityAlert
            testID="home-error"
            tone="warning"
            title={t('common.errorTitle', { defaultValue: 'Could not load your activity' })}
            message={errorMessage}
            actionLabel={t('common.retry')}
            onActionPress={load}
            actionAccessibilityHint={t('dashboard.recentActivity')}
            fontScale={fontScale}
            style={styles.block}
          />
        ) : null}

        {/* ── Protection summary (§9 — computed, never hardcoded) ────────── */}
        <Card testID="home-summary" style={styles.block}>
          <Text
            allowFontScaling={false}
            accessibilityRole="header"
            style={[styles.sectionTitle, { fontSize: sf(theme.typography.h3.size) }]}
          >
            {t('dashboard.summaryTitle')}
          </Text>
          <View style={styles.metricRow}>
            {renderMetric('dashboard.protectedCount', summary ? summary.paymentsProtected : null, 'home-metric-protected')}
            <View style={styles.metricDivider} />
            {renderMetric('dashboard.alertsCount', summary ? summary.alerts : null, 'home-metric-alerts')}
            <View style={styles.metricDivider} />
            {renderMetric('dashboard.holdsCount', summary ? summary.interventions : null, 'home-metric-holds')}
          </View>
          {summary === null ? (
            <Text
              allowFontScaling={false}
              style={[styles.helper, { fontSize: sf(theme.typography.caption.size) }]}
            >
              {loading
                ? t('common.loading')
                : t('dashboard.summaryUnavailable', {
                    defaultValue: 'Protection summary is unavailable right now.',
                  })}
            </Text>
          ) : null}
        </Card>

        {/* ── Recent activity ────────────────────────────────────────────── */}
        <View style={styles.block}>
          <View style={styles.sectionHeader}>
            <Text
              allowFontScaling={false}
              accessibilityRole="header"
              style={[styles.sectionTitle, { fontSize: sf(theme.typography.h3.size) }]}
            >
              {t('dashboard.recentActivity')}
            </Text>
            <Pressable
              testID="home-view-all"
              onPress={() => navigation.navigate('Activity')}
              accessible
              accessibilityRole="button"
              accessibilityLabel={t('dashboard.viewAll')}
              accessibilityHint={t('activity.title')}
              style={({ pressed }) => [styles.linkButton, pressed && styles.pressed]}
            >
              <Text
                allowFontScaling={false}
                style={[styles.linkText, { fontSize: sf(theme.typography.caption.size) }]}
              >
                {t('dashboard.viewAll')} ›
              </Text>
            </Pressable>
          </View>
          {renderRecent()}
        </View>

        {/* ── Primary CTA ────────────────────────────────────────────────── */}
        <PrimaryButton
          testID="home-send-money"
          label={t('dashboard.sendMoney')}
          icon="↗"
          onPress={() => navigation.navigate('Payment')}
          accessibilityHint={t('payment.title')}
          fontScale={fontScale}
          style={styles.block}
        />

        {/* ── Senior Citizen Mode ────────────────────────────────────────── */}
        <Card testID="home-senior-mode" style={styles.block}>
          <View style={styles.switchRow}>
            <View style={styles.switchText}>
              <Text
                allowFontScaling={false}
                style={[styles.rowTitle, { fontSize: sf(theme.typography.bodyBold.size) }]}
              >
                {t('dashboard.seniorMode')}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.rowSubtitle, { fontSize: sf(theme.typography.caption.size) }]}
              >
                {t('dashboard.seniorModeHint')}
              </Text>
            </View>
            <View style={styles.switchTail}>
              <Text
                allowFontScaling={false}
                style={[styles.switchState, { fontSize: sf(theme.typography.tiny.size) }]}
              >
                {isSeniorMode ? t('settings.on') : t('settings.off')}
              </Text>
              <Switch
                testID="home-senior-switch"
                value={isSeniorMode}
                onValueChange={toggleSeniorMode}
                accessibilityRole="switch"
                accessibilityLabel={t('dashboard.seniorMode')}
                accessibilityHint={t('dashboard.seniorModeHint')}
                accessibilityState={{ checked: isSeniorMode }}
                trackColor={{ false: theme.neutral.borderStrong, true: theme.brand.blue }}
                thumbColor={theme.neutral.white}
              />
            </View>
          </View>
        </Card>

        {/* ── Language ───────────────────────────────────────────────────── */}
        <Card testID="home-language" style={styles.block}>
          <Text
            allowFontScaling={false}
            accessibilityRole="header"
            style={[styles.sectionTitle, { fontSize: sf(theme.typography.h3.size) }]}
          >
            {t('dashboard.language')}
          </Text>
          <View
            style={styles.chipRow}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('dashboard.language')}
          >
            {MOCK_LANGUAGES.map(lang => {
              const selected = lang.code === currentLanguage;
              return (
                <Pressable
                  key={lang.code}
                  testID={`home-lang-${lang.code}`}
                  onPress={() => setLanguage(lang.code as SupportedLanguage)}
                  accessible
                  accessibilityRole="radio"
                  accessibilityLabel={lang.nativeLabel}
                  accessibilityHint={t('dashboard.language')}
                  accessibilityState={{ selected }}
                  style={({ pressed }) => [
                    styles.chip,
                    selected && styles.chipSelected,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    allowFontScaling={false}
                    style={[
                      styles.chipText,
                      selected && styles.chipTextSelected,
                      { fontSize: sf(theme.typography.caption.size) },
                    ]}
                  >
                    {selected ? '✓ ' : ''}
                    {lang.nativeLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.lg,
  },
  iconButton: {
    minWidth: theme.control.minTouch,
    minHeight: theme.control.minTouch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.pill,
    backgroundColor: theme.neutral.surface,
    borderWidth: 1,
    borderColor: theme.neutral.border,
  },
  iconGlyph: { color: theme.brand.navy },
  pressed: { opacity: 0.6 },
  block: { marginBottom: theme.spacing.lg },
  rowGap: { marginBottom: theme.spacing.md },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: theme.spacing.md,
  },
  sectionTitle: {
    color: theme.neutral.textPrimary,
    fontWeight: theme.typography.h3.weight,
    marginBottom: theme.spacing.sm,
  },
  linkButton: {
    minHeight: theme.control.minTouch,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.sm,
  },
  linkText: { color: theme.brand.blue, fontWeight: '600' },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    marginTop: theme.spacing.xs,
  },
  metric: { flex: 1, alignItems: 'center', paddingVertical: theme.spacing.sm },
  metricDivider: { width: 1, backgroundColor: theme.neutral.border },
  metricValue: { color: theme.brand.navy, fontWeight: theme.typography.h1.weight },
  metricLabel: {
    color: theme.neutral.textSecondary,
    textAlign: 'center',
    marginTop: theme.spacing.xs,
  },
  helper: {
    color: theme.neutral.textSecondary,
    marginTop: theme.spacing.sm,
  },
  switchRow: { flexDirection: 'row', alignItems: 'center', minHeight: theme.control.minTouch },
  switchText: { flex: 1, paddingRight: theme.spacing.md },
  switchTail: { alignItems: 'center' },
  switchState: { color: theme.neutral.textSecondary, marginBottom: theme.spacing.xs },
  rowTitle: { color: theme.neutral.textPrimary, fontWeight: theme.typography.bodyBold.weight },
  rowSubtitle: { color: theme.neutral.textSecondary, marginTop: theme.spacing.xs },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing.xs },
  chip: {
    minHeight: theme.control.minTouch,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.neutral.border,
    backgroundColor: theme.neutral.surfaceAlt,
    marginRight: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  chipSelected: {
    backgroundColor: theme.brand.blueSoft,
    borderColor: theme.brand.blue,
  },
  chipText: { color: theme.neutral.textSecondary, fontWeight: '600' },
  chipTextSelected: { color: theme.brand.blueDark },
  bottomNav: { borderTopWidth: 0, paddingBottom: 0 },
});

export default HomeScreen;
