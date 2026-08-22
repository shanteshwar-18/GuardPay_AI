/**
 * GuardPay AI — Real-Time Security Alert Notifications
 *
 * Thin wrapper over the native `GuardPayNotifications` module (see
 * android/app/src/main/java/com/guardpayui/NotificationModule.kt). This is the
 * feature the Permissions screen's `POST_NOTIFICATIONS` request exists to
 * enable ("To show real-time risk and security alerts") — requesting the
 * permission alone shows nothing; this module is what actually posts one.
 *
 * Never throws: a notification failing to show must not break the payment
 * flow it is trying to warn about.
 */

import { NativeModules, Platform } from 'react-native';

interface GuardPayNotificationsNative {
  notify(title: string, message: string): Promise<boolean>;
  areNotificationsEnabled(): Promise<boolean>;
}

const Native: GuardPayNotificationsNative | undefined = NativeModules.GuardPayNotifications;

/** True only on a real Android device/emulator with the native module linked. */
export const notificationsSupported = Platform.OS === 'android' && !!Native?.notify;

/**
 * Post a real Android notification. Resolves `false` (never rejects) when
 * notifications are unsupported or disabled — callers should treat that as
 * "signal degraded", never as a reason to interrupt the payment flow.
 */
export async function notify(title: string, message: string): Promise<boolean> {
  if (!Native?.notify) return false;
  try {
    return await Native.notify(title, message);
  } catch (err) {
    console.warn('[GuardPay] notify() failed:', err);
    return false;
  }
}

export async function areNotificationsEnabled(): Promise<boolean> {
  if (!Native?.areNotificationsEnabled) return false;
  try {
    return await Native.areNotificationsEnabled();
  } catch {
    return false;
  }
}

/** Fires the risk-tier alert a WARNING/HOLD/INTERCEPT decision should surface. */
export function notifyRiskDecision(
  tier: 'WARNING' | 'HOLD' | 'INTERCEPT',
  amount: number,
  beneficiaryName: string,
): Promise<boolean> {
  const titles: Record<typeof tier, string> = {
    WARNING: 'GuardPay: Unusual payment detected',
    HOLD: 'GuardPay: Payment on hold',
    INTERCEPT: 'GuardPay: Payment blocked',
  };
  const amountStr = `₹${amount.toLocaleString('en-IN')}`;
  const bodies: Record<typeof tier, string> = {
    WARNING: `Your payment of ${amountStr} to ${beneficiaryName} looks unusual. Please verify before continuing.`,
    HOLD: `GuardPay is holding your payment of ${amountStr} to ${beneficiaryName} for your safety.`,
    INTERCEPT: `GuardPay blocked a payment of ${amountStr} to ${beneficiaryName} — this looked like a scam.`,
  };
  return notify(titles[tier], bodies[tier]);
}
