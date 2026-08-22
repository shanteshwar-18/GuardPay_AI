/**
 * GuardPay AI — SettingsScreen  ·  product spec §24
 *
 * §24 is explicit: "Do not create UI-only toggles." Every switch on this screen
 * writes through to persistent storage and re-hydrates from it on mount:
 *
 *   Active Protection  → AsyncStorage 'guardpay:activeProtection'
 *   Voice Alerts       → AsyncStorage 'guardpay:voiceAlerts'
 *   Notifications      → AsyncStorage 'guardpay:notifications'
 *   Senior Citizen Mode→ SeniorModeContext (which persists it itself)
 *   Language           → languageState.setLanguage (persists + swaps i18next)
 *
 * The trusted-contact count is read from the backend and degrades quietly when
 * it is unreachable (§41) — the row stays tappable either way.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import {
  AppHeader,
  BottomNavigation,
  Card,
  ScreenContainer,
  SecondaryButton,
  SecurityAlert,
} from '../components/guardpay';
import type { BottomNavTabKey } from '../components/guardpay';
import { useScaledFont, useSeniorMode } from '../context/SeniorModeContext';
import { MOCK_LANGUAGES } from '../mock/mockData';
import { ApiError, listTrustedContacts } from '../services/api';
import { useLanguage } from '../services/languageState';
import type { SupportedLanguage } from '../i18n/translations';
import theme from '../theme';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'Settings'>;

/** Persisted preference keys — shared with HomeScreen and the alert pipeline. */
const KEY_ACTIVE_PROTECTION = 'guardpay:activeProtection';
const KEY_VOICE_ALERTS = 'guardpay:voiceAlerts';
const KEY_NOTIFICATIONS = 'guardpay:notifications';

/** All three default to ON; only an explicit 'false' turns one off. */
function readBool(stored: string | null): boolean {
  return stored !== 'false';
}

export function SettingsScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const sf = useScaledFont();
  const { fontScale, isSeniorMode, toggleSeniorMode } = useSeniorMode();
  const { currentLanguage, setLanguage } = useLanguage();

  const [activeProtection, setActiveProtection] = useState(true);
  const [voiceAlerts, setVoiceAlerts] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  const [contactCount, setContactCount] = useState<number | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  // ── Hydrate persisted preferences ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          KEY_ACTIVE_PROTECTION,
          KEY_VOICE_ALERTS,
          KEY_NOTIFICATIONS,
        ]);
        if (cancelled) return;
        const map: Record<string, string | null> = {};
        pairs.forEach(([key, value]) => {
          map[key] = value;
        });
        setActiveProtection(readBool(map[KEY_ACTIVE_PROTECTION]));
        setVoiceAlerts(readBool(map[KEY_VOICE_ALERTS]));
        setNotifications(readBool(map[KEY_NOTIFICATIONS]));
      } catch {
        if (!cancelled) {
          setStorageError(
            t('common.errorTitle', { defaultValue: 'Your preferences could not be loaded.' }),
          );
        }
      } finally {
        if (!cancelled) setHydrated(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [t]);

  // ── Trusted-contact count ─────────────────────────────────────────────────
  const loadContacts = useCallback(async () => {
    try {
      // NOTE: this endpoint returns a bare array, not an envelope object.
      const res = await listTrustedContacts();
      setContactCount(Array.isArray(res) ? res.length : 0);
    } catch (err) {
      // §41: a missing count must never block the settings screen.
      setContactCount(null);
      if (err instanceof ApiError && err.status >= 500) {
        // Server-side problem; the row still navigates, so nothing to surface.
      }
    }
  }, []);

  useEffect(() => {
    loadContacts();
    const unsubscribe = navigation.addListener('focus', loadContacts);
    return unsubscribe;
  }, [loadContacts, navigation]);

  // ── Persisting setters ────────────────────────────────────────────────────
  const persist = useCallback(
    async (key: string, next: boolean, apply: (value: boolean) => void, previous: boolean) => {
      apply(next);
      try {
        await AsyncStorage.setItem(key, String(next));
        setStorageError(null);
      } catch {
        apply(previous); // roll back so the UI never lies about what was saved
        setStorageError(
          t('common.errorTitle', { defaultValue: 'That setting could not be saved.' }),
        );
      }
    },
    [t],
  );

  const onToggleActiveProtection = useCallback(
    (next: boolean) => {
      persist(KEY_ACTIVE_PROTECTION, next, setActiveProtection, activeProtection);
    },
    [activeProtection, persist],
  );

  const onToggleVoiceAlerts = useCallback(
    (next: boolean) => {
      persist(KEY_VOICE_ALERTS, next, setVoiceAlerts, voiceAlerts);
    },
    [persist, voiceAlerts],
  );

  const onToggleNotifications = useCallback(
    (next: boolean) => {
      persist(KEY_NOTIFICATIONS, next, setNotifications, notifications);
    },
    [notifications, persist],
  );

  const onLogout = useCallback(() => {
    Alert.alert(
      t('settings.logout'),
      t('settings.logoutConfirm', {
        defaultValue: 'You will be signed out of GuardPay on this device.',
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settings.logout'),
          style: 'destructive',
          onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Onboarding' }] }),
        },
      ],
    );
  }, [navigation, t]);

  const showInfo = useCallback(
    (titleKey: string, bodyKey: string, bodyDefault: string) => {
      Alert.alert(t(titleKey), t(bodyKey, { defaultValue: bodyDefault }), [
        { text: t('common.ok') },
      ]);
    },
    [t],
  );

  const onNavigate = useCallback(
    (tab: BottomNavTabKey) => {
      switch (tab) {
        case 'home':
          navigation.navigate('Home');
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

  // ── Row renderers ─────────────────────────────────────────────────────────
  const renderSwitchRow = (
    testID: string,
    label: string,
    value: boolean,
    onValueChange: (next: boolean) => void,
    hint?: string,
  ) => (
    <View style={styles.row} testID={testID}>
      <View style={styles.rowText}>
        <Text
          allowFontScaling={false}
          style={[styles.rowTitle, { fontSize: sf(theme.typography.bodyBold.size) }]}
        >
          {label}
        </Text>
        {hint ? (
          <Text
            allowFontScaling={false}
            style={[styles.rowSubtitle, { fontSize: sf(theme.typography.caption.size) }]}
          >
            {hint}
          </Text>
        ) : null}
      </View>
      <View style={styles.rowTail}>
        {/* Word, not just a colour — the state must survive colour blindness. */}
        <Text
          allowFontScaling={false}
          style={[styles.stateText, { fontSize: sf(theme.typography.tiny.size) }]}
        >
          {value ? t('settings.on') : t('settings.off')}
        </Text>
        <Switch
          testID={`${testID}-switch`}
          value={value}
          onValueChange={onValueChange}
          disabled={!hydrated}
          accessibilityRole="switch"
          accessibilityLabel={label}
          accessibilityHint={hint}
          accessibilityState={{ checked: value, disabled: !hydrated }}
          trackColor={{ false: theme.neutral.borderStrong, true: theme.brand.blue }}
          thumbColor={theme.neutral.white}
        />
      </View>
    </View>
  );

  const renderLinkRow = (
    testID: string,
    label: string,
    onPress: () => void,
    valueText?: string,
    hint?: string,
  ) => (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessible
      accessibilityRole="button"
      accessibilityLabel={valueText ? `${label}, ${valueText}` : label}
      accessibilityHint={hint}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowText}>
        <Text
          allowFontScaling={false}
          style={[styles.rowTitle, { fontSize: sf(theme.typography.bodyBold.size) }]}
        >
          {label}
        </Text>
      </View>
      <View style={styles.rowTail}>
        {valueText ? (
          <Text
            allowFontScaling={false}
            style={[styles.stateText, { fontSize: sf(theme.typography.caption.size) }]}
          >
            {valueText}
          </Text>
        ) : null}
        <Text
          allowFontScaling={false}
          style={[styles.chevron, { fontSize: sf(theme.typography.body.size) }]}
        >
          ›
        </Text>
      </View>
    </Pressable>
  );

  const contactsValue =
    contactCount === null
      ? t('common.unavailable', { defaultValue: 'Unavailable' })
      : t('settings.contactsCount', { count: contactCount });

  return (
    <ScreenContainer
      testID="settings-screen"
      scroll
      padded={false}
      contentStyle={styles.content}
      footer={
        <BottomNavigation
          testID="settings-bottom-nav"
          active="settings"
          onNavigate={onNavigate}
          labels={navLabels}
          hints={{ home: t('dashboard.protected'), activity: t('activity.title') }}
          fontScale={fontScale}
          style={styles.bottomNav}
        />
      }
    >
      <AppHeader
        testID="settings-header"
        title={t('settings.title')}
        onBack={() => navigation.goBack()}
        backAccessibilityLabel={t('risk.common.back')}
        backAccessibilityHint={t('nav.home')}
        fontScale={fontScale}
        style={styles.header}
      />

      <View style={styles.gutter}>
        {/* ── Profile ──────────────────────────────────────────────────── */}
        <Card testID="settings-profile" tone="tinted" style={styles.block}>
          <View style={styles.profile}>
            <View style={[styles.avatar, { width: sf(52), height: sf(52), borderRadius: sf(26) }]}>
              <Text
                allowFontScaling={false}
                style={[styles.avatarText, { fontSize: sf(theme.typography.h2.size) }]}
              >
                🛡
              </Text>
            </View>
            <View style={styles.profileText}>
              <Text
                allowFontScaling={false}
                accessibilityRole="header"
                style={[styles.profileName, { fontSize: sf(theme.typography.h3.size) }]}
              >
                {t('settings.profileName', { defaultValue: 'GuardPay account' })}
              </Text>
              <Text
                allowFontScaling={false}
                style={[styles.rowSubtitle, { fontSize: sf(theme.typography.caption.size) }]}
              >
                {activeProtection ? t('dashboard.protectedSub') : t('dashboard.inactiveSub')}
              </Text>
            </View>
          </View>
        </Card>

        {storageError ? (
          <SecurityAlert
            testID="settings-storage-error"
            tone="warning"
            title={storageError}
            compact
            fontScale={fontScale}
            style={styles.block}
          />
        ) : null}

        {/* ── Protection ───────────────────────────────────────────────── */}
        <Text
          allowFontScaling={false}
          accessibilityRole="header"
          style={[styles.groupTitle, { fontSize: sf(theme.typography.caption.size) }]}
        >
          {t('settings.protection')}
        </Text>
        <Card testID="settings-protection-group" style={styles.block}>
          {renderSwitchRow(
            'settings-active-protection',
            t('settings.activeProtection'),
            activeProtection,
            onToggleActiveProtection,
            t('dashboard.protectedSub'),
          )}
          <View style={styles.divider} />
          {renderSwitchRow(
            'settings-senior-mode',
            t('settings.seniorMode'),
            isSeniorMode,
            () => toggleSeniorMode(),
            t('dashboard.seniorModeHint'),
          )}
          <View style={styles.divider} />
          {renderLinkRow(
            'settings-trusted-contacts',
            t('settings.trustedContacts'),
            () => navigation.navigate('TrustedContacts'),
            contactsValue,
            t('trustedContact.body'),
          )}
          <View style={styles.divider} />

          {/* Inline language picker */}
          <View style={styles.languageBlock} testID="settings-language">
            <Text
              allowFontScaling={false}
              style={[styles.rowTitle, { fontSize: sf(theme.typography.bodyBold.size) }]}
            >
              {t('settings.language')}
            </Text>
            <View
              style={styles.chipRow}
              accessibilityRole="radiogroup"
              accessibilityLabel={t('settings.language')}
            >
              {MOCK_LANGUAGES.map(lang => {
                const selected = lang.code === currentLanguage;
                return (
                  <Pressable
                    key={lang.code}
                    testID={`settings-lang-${lang.code}`}
                    onPress={() => setLanguage(lang.code as SupportedLanguage)}
                    accessible
                    accessibilityRole="radio"
                    accessibilityLabel={lang.nativeLabel}
                    accessibilityHint={t('settings.language')}
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
          </View>
          <View style={styles.divider} />

          {renderSwitchRow(
            'settings-voice-alerts',
            t('settings.voiceAlerts'),
            voiceAlerts,
            onToggleVoiceAlerts,
          )}
          <View style={styles.divider} />
          {renderSwitchRow(
            'settings-notifications',
            t('settings.notifications'),
            notifications,
            onToggleNotifications,
          )}
        </Card>

        {/* ── About ────────────────────────────────────────────────────── */}
        <Text
          allowFontScaling={false}
          accessibilityRole="header"
          style={[styles.groupTitle, { fontSize: sf(theme.typography.caption.size) }]}
        >
          {t('settings.about')}
        </Text>
        <Card testID="settings-about-group" style={styles.block}>
          {renderLinkRow('settings-privacy', t('settings.privacy'), () =>
            showInfo(
              'settings.privacy',
              'settings.privacyBody',
              'GuardPay analyses payment context only during an active protected session. Signals are used to score risk and are never sold.',
            ),
          )}
          <View style={styles.divider} />
          {renderLinkRow('settings-about-app', t('settings.aboutApp'), () =>
            showInfo(
              'settings.aboutApp',
              'settings.aboutAppBody',
              'GuardPay AI — real-time UPI fraud intervention. This build is a prototype.',
            ),
          )}
          <View style={styles.divider} />
          {renderLinkRow('settings-help', t('settings.help'), () =>
            showInfo(
              'settings.help',
              'settings.helpBody',
              'Add a trusted contact so GuardPay can verify high-risk payments with someone you know.',
            ),
          )}
        </Card>

        <SecondaryButton
          testID="settings-logout"
          label={t('settings.logout')}
          onPress={onLogout}
          tone="danger"
          accessibilityHint={t('settings.logoutConfirm', {
            defaultValue: 'You will be signed out of GuardPay on this device.',
          })}
          fontScale={fontScale}
          style={styles.block}
        />
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing.xxl },
  header: { paddingHorizontal: theme.spacing.xl },
  gutter: { paddingHorizontal: theme.spacing.xl, paddingTop: theme.spacing.lg },
  block: { marginBottom: theme.spacing.lg },
  profile: { flexDirection: 'row', alignItems: 'center' },
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.brand.navy,
    marginRight: theme.spacing.lg,
  },
  avatarText: { color: theme.neutral.textInverse },
  profileText: { flex: 1 },
  profileName: { color: theme.neutral.textPrimary, fontWeight: theme.typography.h3.weight },
  groupTitle: {
    color: theme.neutral.textMuted,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: theme.spacing.sm,
    marginLeft: theme.spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: theme.control.minTouch,
    paddingVertical: theme.spacing.sm,
  },
  rowText: { flex: 1, paddingRight: theme.spacing.md },
  rowTail: { flexDirection: 'row', alignItems: 'center' },
  rowTitle: { color: theme.neutral.textPrimary, fontWeight: theme.typography.bodyBold.weight },
  rowSubtitle: { color: theme.neutral.textSecondary, marginTop: theme.spacing.xs },
  stateText: { color: theme.neutral.textSecondary, marginRight: theme.spacing.sm },
  chevron: { color: theme.neutral.textMuted },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.neutral.border,
    marginVertical: theme.spacing.xs,
  },
  languageBlock: { paddingVertical: theme.spacing.sm },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: theme.spacing.md },
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
  chipSelected: { backgroundColor: theme.brand.blueSoft, borderColor: theme.brand.blue },
  chipText: { color: theme.neutral.textSecondary, fontWeight: '600' },
  chipTextSelected: { color: theme.brand.blueDark },
  pressed: { opacity: 0.6 },
  bottomNav: { borderTopWidth: 0, paddingBottom: 0 },
});

export default SettingsScreen;
