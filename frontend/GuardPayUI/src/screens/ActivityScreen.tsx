/**
 * GuardPay AI — ActivityScreen  ·  product spec §23
 *
 * Payment history with the safety result attached to every row. The filter
 * chips map 1:1 onto the backend's `ActivityFilter`, so filtering is done by
 * the service that owns the data rather than re-derived on the client (§42).
 *
 * §41: an unreachable backend produces a visible, retryable error state — never
 * a crash and never a silently empty list.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  AppHeader,
  BottomNavigation,
  EmptyState,
  ScreenContainer,
  SecurityAlert,
  TransactionCard,
} from '../components/guardpay';
import type { BottomNavTabKey } from '../components/guardpay';
import { resolveTier } from '../config/riskTiers';
import type { RiskTierId } from '../config/riskTiers';
import { useScaledFont, useSeniorMode } from '../context/SeniorModeContext';
import { ApiError, listTransactions } from '../services/api';
import type { ActivityFilter, TransactionRecord } from '../services/api';
import { formatINRCompact } from '../services/format';
import theme from '../theme';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Activity'>;

const FILTERS: ReadonlyArray<{ key: ActivityFilter; labelKey: string }> = [
  { key: 'all', labelKey: 'activity.all' },
  { key: 'safe', labelKey: 'activity.safe' },
  { key: 'warning', labelKey: 'activity.warning' },
  { key: 'held', labelKey: 'activity.held' },
  { key: 'blocked', labelKey: 'activity.blocked' },
];

const TIER_BADGE_KEY: Record<RiskTierId, string> = {
  SAFE: 'risk.badge.safe',
  WARNING: 'risk.badge.warning',
  HOLD: 'risk.badge.hold',
  INTERCEPT: 'risk.badge.intercept',
};

function hasRiskData(txn: TransactionRecord): boolean {
  return txn.risk_tier != null || typeof txn.risk_score === 'number';
}

function timeValue(iso: string | undefined): number {
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? 0 : parsed;
}

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

export function ActivityScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const sf = useScaledFont();
  const { fontScale } = useSeniorMode();

  const [filter, setFilter] = useState<ActivityFilter>(route.params?.initialFilter ?? 'all');
  const [transactions, setTransactions] = useState<TransactionRecord[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const load = useCallback(
    async (nextFilter: ActivityFilter, mode: 'initial' | 'refresh') => {
      if (mode === 'refresh') setRefreshing(true);
      else setLoading(true);
      setErrorMessage(null);
      try {
        // NOTE: this endpoint returns a bare array, not an envelope object.
        const res = await listTransactions(nextFilter);
        setTransactions(Array.isArray(res) ? res : []);
      } catch (err) {
        setTransactions(null);
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : t('common.offlineBody', {
                defaultValue: 'GuardPay could not reach the server. Pull down to try again.',
              }),
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [t],
  );

  useEffect(() => {
    load(filter, 'initial');
  }, [filter, load]);

  const onRefresh = useCallback(() => {
    load(filter, 'refresh');
  }, [filter, load]);

  const rows = useMemo(() => {
    if (!transactions) return [];
    return transactions
      .slice()
      .sort((a, b) => timeValue(b.created_at) - timeValue(a.created_at));
  }, [transactions]);

  const onNavigate = useCallback(
    (tab: BottomNavTabKey) => {
      switch (tab) {
        case 'home':
          navigation.navigate('Home');
          return;
        case 'activity':
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

  const renderBody = () => {
    if (loading && !refreshing) {
      return (
        <View style={styles.centre} testID="activity-loading">
          <ActivityIndicator size="large" color={theme.brand.blue} />
          <Text
            allowFontScaling={false}
            style={[styles.helper, { fontSize: sf(theme.typography.body.size) }]}
          >
            {t('common.loading')}
          </Text>
        </View>
      );
    }

    if (errorMessage) {
      return (
        <SecurityAlert
          testID="activity-error"
          tone="warning"
          title={t('common.errorTitle', { defaultValue: 'Could not load your activity' })}
          message={errorMessage}
          actionLabel={t('common.retry')}
          onActionPress={onRefresh}
          actionAccessibilityHint={t('activity.title')}
          fontScale={fontScale}
          style={styles.block}
        />
      );
    }

    if (rows.length === 0) {
      return (
        <EmptyState
          testID="activity-empty"
          icon="🗂"
          title={t('activity.empty')}
          message={t('activity.emptyBody')}
          ctaLabel={t('dashboard.sendMoney')}
          onCtaPress={() => navigation.navigate('Payment')}
          ctaAccessibilityHint={t('payment.title')}
          fontScale={fontScale}
        />
      );
    }

    return rows.map(txn => {
      const showRisk = hasRiskData(txn);
      const tier = showRisk ? resolveTier(txn.risk_tier, txn.risk_score ?? 0) : undefined;
      return (
        <TransactionCard
          key={txn.transaction_id}
          testID={`activity-txn-${txn.transaction_id}`}
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
    });
  };

  return (
    <ScreenContainer
      testID="activity-screen"
      padded={false}
      footer={
        <BottomNavigation
          testID="activity-bottom-nav"
          active="activity"
          onNavigate={onNavigate}
          labels={navLabels}
          hints={{ home: t('dashboard.protected'), settings: t('settings.title') }}
          fontScale={fontScale}
          style={styles.bottomNav}
        />
      }
    >
      <AppHeader
        testID="activity-header"
        title={t('activity.title')}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t('risk.common.back')}
        backAccessibilityHint={t('nav.home')}
        fontScale={fontScale}
        style={styles.header}
      />

      {/* ── Filter chips ─────────────────────────────────────────────────── */}
      <View
        style={styles.chipBar}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('activity.title')}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {FILTERS.map(item => {
            const selected = item.key === filter;
            const label = t(item.labelKey);
            return (
              <Pressable
                key={item.key}
                testID={`activity-filter-${item.key}`}
                onPress={() => setFilter(item.key)}
                accessible
                accessibilityRole="radio"
                accessibilityLabel={label}
                accessibilityHint={t('activity.title')}
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
                  {label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        testID="activity-list"
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[theme.brand.blue]}
            tintColor={theme.brand.blue}
            accessibilityLabel={t('common.retry')}
          />
        }
      >
        {renderBody()}
      </ScrollView>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: theme.spacing.xl },
  chipBar: { paddingVertical: theme.spacing.md },
  chipRow: { paddingHorizontal: theme.spacing.xl },
  chip: {
    minHeight: theme.control.minTouch,
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.lg,
    borderRadius: theme.radius.pill,
    borderWidth: 1,
    borderColor: theme.neutral.border,
    backgroundColor: theme.neutral.surface,
    marginRight: theme.spacing.sm,
  },
  chipSelected: { backgroundColor: theme.brand.blueSoft, borderColor: theme.brand.blue },
  chipText: { color: theme.neutral.textSecondary, fontWeight: '600' },
  chipTextSelected: { color: theme.brand.blueDark },
  pressed: { opacity: 0.6 },
  listContent: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
  },
  rowGap: { marginBottom: theme.spacing.md },
  block: { marginBottom: theme.spacing.lg },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: theme.spacing.huge },
  helper: { color: theme.neutral.textSecondary, marginTop: theme.spacing.md },
  bottomNav: { borderTopWidth: 0, paddingBottom: 0 },
});

export default ActivityScreen;
