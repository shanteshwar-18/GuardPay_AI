/**
 * GuardPay AI — PermissionsScreen (product spec §8)
 *
 * Asks for the runtime permissions GuardPay can actually use, explains WHY in
 * plain language, and — critically — never lies about the ones it cannot.
 *
 * HONESTY CONTRACT (§8): "Do not fake permission states… clearly label it as a
 * simulated/demo signal." All four rows below trigger a REAL Android permission
 * dialog and report the REAL result:
 *
 *   • Microphone      — `RECORD_AUDIO`, declared in AndroidManifest.xml, checked
 *                       on mount and requested through PermissionsAndroid.
 *   • Notifications   — `POST_NOTIFICATIONS`, declared in the manifest, real on
 *                       Android 13+. Below API 33 the permission does not exist
 *                       and notifications are granted by install, so the row
 *                       reports granted WITHOUT prompting for a dialog the OS
 *                       would never show.
 *   • Phone / Call    — `READ_PHONE_STATE`, declared in the manifest, requested
 *                       through PermissionsAndroid exactly like microphone.
 *   • Screen Capture  — Android has no simple runtime permission for this; the
 *                       only real OS mechanism is MediaProjectionManager's
 *                       system consent dialog ("Start recording or casting?").
 *                       `ScreenCaptureModule` (native, android/app/.../
 *                       ScreenCaptureModule.kt) launches that real dialog and
 *                       reports the real result. GuardPay stops the returned
 *                       projection immediately without capturing any frames —
 *                       this is a genuine consent check, not a screen-reading
 *                       pipeline, and the row says so via `screenCaptureNote`.
 *                       Android does not let an app query prior MediaProjection
 *                       consent, so this one resets to "not requested" each
 *                       time the screen mounts — that is an accurate reflection
 *                       of OS behaviour, not a bug.
 *
 * DEGRADE, NEVER BLOCK: Continue is always enabled. A denied permission costs
 * signal quality, not access to the app.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  NativeModules,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';

import { RootStackParamList } from '../types/navigation';
import { theme } from '../theme';
import {
  ScreenContainer,
  PrimaryButton,
  PermissionCard,
  SecurityAlert,
  useFontScale,
} from '../components/guardpay';
import type { PermissionCardProps } from '../components/guardpay';
import { notify } from '../services/notifications';

type Props = NativeStackScreenProps<RootStackParamList, 'Permissions'>;

/** The status vocabulary PermissionCard understands. */
type CardStatus = PermissionCardProps['status'];

/**
 * `blocked` == the OS answered `never_ask_again`. The system dialog will not be
 * shown again, so we stop offering an Allow button that could not do anything.
 */
type RealPermissionState = { status: CardStatus; blocked: boolean };

const INITIAL_REAL: RealPermissionState = { status: 'not-requested', blocked: false };

/** POST_NOTIFICATIONS exists only from Android 13 (API 33). */
const ANDROID_13 = 33;

const IS_ANDROID = Platform.OS === 'android';

/** Native module backing the real MediaProjection consent dialog (Android only). */
const ScreenCaptureModule: { requestPermission?: () => Promise<boolean> } | undefined =
  NativeModules.ScreenCaptureModule;

/** Platform.Version is a number on Android and a version string on iOS. */
function androidApiLevel(): number {
  const version = Platform.Version;
  return typeof version === 'number' ? version : Number.parseInt(String(version), 10) || 0;
}

export function PermissionsScreen({ navigation, route }: Props) {
  const { t } = useTranslation();
  const { sf } = useFontScale();

  const [mic, setMic] = useState<RealPermissionState>(INITIAL_REAL);
  const [notifications, setNotifications] = useState<RealPermissionState>(INITIAL_REAL);
  const [phoneState, setPhoneState] = useState<RealPermissionState>(INITIAL_REAL);
  const [screenCapture, setScreenCapture] = useState<RealPermissionState>(INITIAL_REAL);
  const [screenCaptureBusy, setScreenCaptureBusy] = useState(false);

  const fromSettings = route.params?.fromSettings ?? false;

  // ── Read the TRUE current status on mount ───────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    const hydrate = async () => {
      // Off Android there is no PermissionsAndroid to ask, so we say so rather
      // than inventing a granted state.
      if (!IS_ANDROID) {
        if (!cancelled) {
          setMic({ status: 'simulated', blocked: false });
          setNotifications({ status: 'simulated', blocked: false });
          setPhoneState({ status: 'simulated', blocked: false });
          setScreenCapture({ status: 'simulated', blocked: false });
        }
        return;
      }

      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
        );
        if (!cancelled) {
          setMic({ status: granted ? 'granted' : 'not-requested', blocked: false });
        }
      } catch (err) {
        console.warn('[GuardPay] Microphone permission check failed:', err);
        if (!cancelled) setMic({ status: 'not-requested', blocked: false });
      }

      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
        );
        if (!cancelled) {
          setPhoneState({ status: granted ? 'granted' : 'not-requested', blocked: false });
        }
      } catch (err) {
        console.warn('[GuardPay] Phone-state permission check failed:', err);
        if (!cancelled) setPhoneState({ status: 'not-requested', blocked: false });
      }

      // Android has no API to query a prior MediaProjection consent — the token
      // is single-use and not persisted by the OS. "Not requested" is therefore
      // always the accurate starting state, never a placeholder.
      if (!cancelled && !ScreenCaptureModule?.requestPermission) {
        setScreenCapture({ status: 'simulated', blocked: false });
      }

      if (androidApiLevel() < ANDROID_13) {
        // Pre-13 there is no POST_NOTIFICATIONS runtime permission — notifications
        // are granted at install time. Prompting would show nothing at all.
        if (!cancelled) setNotifications({ status: 'granted', blocked: false });
        return;
      }

      try {
        const granted = await PermissionsAndroid.check(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
        );
        if (!cancelled) {
          setNotifications({ status: granted ? 'granted' : 'not-requested', blocked: false });
        }
      } catch (err) {
        console.warn('[GuardPay] Notification permission check failed:', err);
        if (!cancelled) setNotifications({ status: 'not-requested', blocked: false });
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, []);

  // ── Real requests ───────────────────────────────────────────────────────────
  const requestReal = useCallback(
    async (
      permission: (typeof PermissionsAndroid.PERMISSIONS)[string],
      rationaleTitle: string,
      rationaleMessage: string,
      apply: (next: RealPermissionState) => void,
    ) => {
      if (!IS_ANDROID) return;
      try {
        const result = await PermissionsAndroid.request(permission, {
          title: rationaleTitle,
          message: rationaleMessage,
          buttonPositive: t('permissions.allow'),
        });

        if (result === PermissionsAndroid.RESULTS.GRANTED) {
          apply({ status: 'granted', blocked: false });
          // Prove the grant actually works right away, for the one permission
          // whose entire purpose is showing something to the user.
          if (permission === PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS) {
            void notify(
              t('permissions.notifTestTitle', { defaultValue: 'GuardPay notifications are on' }),
              t('permissions.notifTestBody', {
                defaultValue: "You'll see an alert here when GuardPay flags a risky payment.",
              }),
            );
          }
        } else if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
          // Denied permanently: keep the honest "denied" status but withdraw the
          // Allow button, since the OS will no longer show the dialog.
          apply({ status: 'denied', blocked: true });
        } else {
          apply({ status: 'denied', blocked: false });
        }
      } catch (err) {
        // A throwing bridge must not take the launch path down with it.
        console.warn('[GuardPay] Permission request failed:', err);
        apply({ status: 'denied', blocked: false });
      }
    },
    [t],
  );

  const requestMicrophone = useCallback(() => {
    void requestReal(
      PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
      t('permissions.micName'),
      t('permissions.micDesc'),
      setMic,
    );
  }, [requestReal, t]);

  const requestNotifications = useCallback(() => {
    if (androidApiLevel() < ANDROID_13) {
      setNotifications({ status: 'granted', blocked: false });
      return;
    }
    void requestReal(
      PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      t('permissions.notifName'),
      t('permissions.notifDesc'),
      setNotifications,
    );
  }, [requestReal, t]);

  const requestPhoneState = useCallback(() => {
    void requestReal(
      PermissionsAndroid.PERMISSIONS.READ_PHONE_STATE,
      t('permissions.phoneName'),
      t('permissions.phoneDesc'),
      setPhoneState,
    );
  }, [requestReal, t]);

  const requestScreenCapture = useCallback(async () => {
    if (!IS_ANDROID || !ScreenCaptureModule?.requestPermission) return;
    setScreenCaptureBusy(true);
    try {
      const granted = await ScreenCaptureModule.requestPermission();
      setScreenCapture({ status: granted ? 'granted' : 'denied', blocked: false });
    } catch (err) {
      // The dialog failing to launch is not the same as the user denying it —
      // report it as not-requested so Allow stays offered rather than showing a
      // false "Denied".
      console.warn('[GuardPay] Screen-capture consent request failed:', err);
      setScreenCapture({ status: 'not-requested', blocked: false });
    } finally {
      setScreenCaptureBusy(false);
    }
  }, []);

  const handleContinue = useCallback(() => {
    if (fromSettings && navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.replace('Home');
  }, [fromSettings, navigation]);

  // ── Copy helpers (every string via t(), never colour alone) ─────────────────
  const statusWord = useCallback(
    (status: CardStatus): string => {
      switch (status) {
        case 'granted':
          return t('permissions.granted');
        case 'denied':
          return t('permissions.denied');
        case 'simulated':
          return t('permissions.simulated');
        default:
          return t('permissions.notRequested');
      }
    },
    [t],
  );

  const deniedNames = useMemo(() => {
    const names: string[] = [];
    if (mic.status === 'denied') names.push(t('permissions.micName'));
    if (notifications.status === 'denied') names.push(t('permissions.notifName'));
    if (phoneState.status === 'denied') names.push(t('permissions.phoneName'));
    if (screenCapture.status === 'denied') names.push(t('permissions.screenName'));
    return names;
  }, [mic.status, notifications.status, phoneState.status, screenCapture.status, t]);

  const simulatedNote = t('permissions.simulatedNote');

  return (
    <ScreenContainer
      scroll
      background="bg"
      testID="permissions-screen"
      footer={
        <PrimaryButton
          label={t('permissions.continue')}
          onPress={handleContinue}
          accessibilityHint={t('permissions.subtitle')}
          testID="permissions-continue"
        />
      }
    >
      <Text
        allowFontScaling={false}
        accessible
        accessibilityRole="header"
        style={[
          styles.title,
          { fontSize: sf(theme.typography.h1.size), lineHeight: sf(theme.typography.h1.lineHeight) },
        ]}
      >
        {t('permissions.title')}
      </Text>

      <Text
        allowFontScaling={false}
        accessible
        accessibilityRole="text"
        style={[
          styles.subtitle,
          {
            fontSize: sf(theme.typography.body.size),
            lineHeight: sf(theme.typography.body.lineHeight),
          },
        ]}
      >
        {t('permissions.subtitle')}
      </Text>

      {/* Denied is a degraded state, not a dead end — say so, then let them on. */}
      {deniedNames.length > 0 ? (
        <SecurityAlert
          tone="warning"
          title={`${deniedNames.join(', ')} — ${t('permissions.denied')}`}
          message={t('permissions.subtitle')}
          style={styles.alert}
          testID="permissions-denied-alert"
        />
      ) : null}

      {/* 1 — Microphone: REAL runtime permission (declared in the manifest). */}
      <PermissionCard
        icon="🎙"
        name={t('permissions.micName')}
        description={t('permissions.micDesc')}
        status={mic.status}
        statusLabel={statusWord(mic.status)}
        actionLabel={mic.blocked ? undefined : t('permissions.allow')}
        onRequest={mic.blocked ? undefined : requestMicrophone}
        actionHint={t('permissions.micDesc')}
        style={styles.card}
        testID="permission-microphone"
      />

      {/* 2 — Notifications: REAL on Android 13+, granted-by-install below that. */}
      <PermissionCard
        icon="🔔"
        name={t('permissions.notifName')}
        description={t('permissions.notifDesc')}
        status={notifications.status}
        statusLabel={statusWord(notifications.status)}
        actionLabel={notifications.blocked ? undefined : t('permissions.allow')}
        onRequest={notifications.blocked ? undefined : requestNotifications}
        actionHint={t('permissions.notifDesc')}
        simulatedNote={simulatedNote}
        style={styles.card}
        testID="permission-notifications"
      />

      {/* 3 — Screen capture: real MediaProjection consent dialog via native module. */}
      <PermissionCard
        icon="🖥"
        name={t('permissions.screenName')}
        description={t('permissions.screenDesc')}
        status={screenCapture.status}
        statusLabel={
          screenCaptureBusy ? t('permissions.requesting', { defaultValue: 'Requesting…' })
                             : statusWord(screenCapture.status)
        }
        actionLabel={
          screenCapture.status === 'simulated' || screenCaptureBusy
            ? undefined
            : t('permissions.allow')
        }
        onRequest={
          screenCapture.status === 'simulated' || screenCaptureBusy
            ? undefined
            : requestScreenCapture
        }
        actionHint={t('permissions.screenDesc')}
        simulatedNote={
          screenCapture.status === 'simulated' ? simulatedNote : t('permissions.screenCaptureNote')
        }
        style={styles.card}
        testID="permission-screen-capture"
      />

      {/* 4 — Phone / call state: real READ_PHONE_STATE runtime permission. */}
      <PermissionCard
        icon="☏"
        name={t('permissions.phoneName')}
        description={t('permissions.phoneDesc')}
        status={phoneState.status}
        statusLabel={statusWord(phoneState.status)}
        actionLabel={phoneState.blocked ? undefined : t('permissions.allow')}
        onRequest={phoneState.blocked ? undefined : requestPhoneState}
        actionHint={t('permissions.phoneDesc')}
        style={styles.card}
        testID="permission-phone-state"
      />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  title: {
    marginTop: theme.spacing.xxl,
    color: theme.neutral.textPrimary,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: theme.spacing.sm,
    color: theme.neutral.textSecondary,
  },
  alert: {
    marginTop: theme.spacing.xl,
  },
  card: {
    marginTop: theme.spacing.lg,
  },
});

export default PermissionsScreen;
